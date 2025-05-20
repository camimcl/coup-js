/* eslint-disable no-console */
import Case from './Case.ts';
import Player from '../core/entities/Player.ts';
import GameState from '../core/GameState.ts';
import { COUP_PERFORMED } from '../constants/events.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';

export default class CoupCase extends Case {
  private targetPlayer!: Player;

  constructor(gameState: GameState) {
    super('Coup', gameState);
  }

  public canExecute(): boolean {
    return this.gameState.getCurrentTurnPlayer().getCoinsAmount() >= 7;
  }

  async runCase() {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    const coins = this.currentPlayer.getCoinsAmount();

    // Impedir execução da ação se não tiver moedas suficientes
    if (coins < 7) {
      throw new Error(`${this.currentPlayer.name} não tem moedas suficientes para dar o golpe.`);
    }

    // Pede para o jogador escolher quem será o alvo
    await this.promptChooseTarget();

    // Gasta 7 moedas
    this.currentPlayer.removeCoins(7);

    const namespace = this.gameState.getNamespace();

    namespace.emit(COUP_PERFORMED, { originPlayerUUID: this.currentPlayer.uuid });
    emitActionLog(`${this.currentPlayer.name}: Gasto 7 moedas e aplico golpe de estado em ${this.targetPlayer.name}`, this.gameState.getNamespace())

    // Alvo escolhe carta para perder
    const chosenCardUUID = await this.promptService.askSingleCard(this.targetPlayer);

    // Descarte visível
    const discardedUuid = this.targetPlayer.getCardByUUID(chosenCardUUID)
    this.gameState.discardPlayerCard(chosenCardUUID, this.targetPlayer);
    emitWarningLog(`${this.targetPlayer.name} descartou um ${discardedUuid.name}`, this.gameState.getNamespace())
    console.debug(`${this.targetPlayer.name} perdeu uma carta por golpe de estado.`);

    this.finishTurn();
  }

  private async promptChooseTarget(): Promise<void> {
    const options = this.gameState
      .getActivePlayers()
      .filter((p) => p.uuid !== this.currentPlayer.uuid)
      .map((p) => ({ label: p.name, value: p.uuid }));

    const chosenUuid: string = await this.promptService.prompt(
      this.currentPlayer.socket,
      'Escolha um jogador para dar o golpe de Estado',
      options,
      options[0].value,
    );

    console.log(`Chosen target: ${chosenUuid}`);

    const target = this.gameState.getPlayerByUUID(chosenUuid);

    if (!target) throw new Error('Jogador alvo não encontrado.');

    this.targetPlayer = target;
  }
}
