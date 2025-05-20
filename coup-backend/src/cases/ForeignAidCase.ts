/* eslint-disable no-console */
import { PROMPT_OPTION_CHALLENGE_ACCEPT } from '../constants/promptOptions.ts';
import { CARD_VARIANT_DUKE } from '../constants/cardVariants.ts';
import Case from './Case.ts';
import Player from '../core/entities/Player.ts';
import GameState from '../core/GameState.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';

export default class ForeignAidCase extends Case {
  private challengerPlayer!: Player;

  constructor(gameState: GameState) {
    super('Foreign Aid', gameState);
  }

  async runCase() {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    const {
      challengerId,
      response: challengeToAid,
    } = await this.promptService.challengeOthers(
      this.currentPlayer.socket,
      this.gameState.getActivePlayers().length,
      `${this.currentPlayer.name} requisita auxílio externo (2 moedas). Alguém se declara Duque para bloquear?`,
    );

    if (challengeToAid === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      // Alguém se declarou Duque e bloqueou. Agora, o jogador atual pode contestar esse Duque.
      await this.resolveDukeBlock(challengerId);
    } else {
      // Ninguém contestou. Ação bem-sucedida.
      this.currentPlayer.addCoins(2);
      emitActionLog(`${this.currentPlayer.name} Pega auxílio e recebe 2 moedas. `,this.gameState.getNamespace())
      console.debug(`${this.currentPlayer.name} recebeu 2 moedas (auxílio externo)`);
    }

    this.finishTurn();
  }

  private async resolveDukeBlock(challengerId: string) {
    this.challengerPlayer = this.gameState.getPlayerByUUID(challengerId);

    emitActionLog(`${this.challengerPlayer.name}: Sou o duque não deixo pegar auxílio.`,this.gameState.getNamespace())
    const message = `${this.challengerPlayer!.name} bloqueou o auxílio externo dizendo ser Duque. Deseja contestar?`;

    const response = await this.promptService.challengePlayer(this.currentPlayer.socket, message);

    if (response === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      await this.resolveChallengeToDuke();
    } else {
      // Ninguém contestou o Duque. Bloqueio é bem-sucedido.
      emitWarningLog(`${this.currentPlayer.name} Não contesta o Duque e nao recebe auxílio. `,this.gameState.getNamespace())
      console.debug(`O bloqueio do Duque por ${this.challengerPlayer.name} foi aceito. ${this.currentPlayer.name} não recebe moedas.`);
    }
  }

  private async resolveChallengeToDuke() {
    console.debug(`${this.currentPlayer.name} contestou o Duque de ${this.challengerPlayer.name}`);
    emitActionLog(`${this.currentPlayer.name}: Contesto o Duque de ${this.challengerPlayer.name}`,this.gameState.getNamespace())

    // Duque revela carta
    const dukeCardUUID = await this.promptService.askSingleCard(this.challengerPlayer!);
    const revealedCard = this.challengerPlayer!.getCardByUUID(dukeCardUUID);

    if (revealedCard.variant !== CARD_VARIANT_DUKE) {
      // Duque era falso — carta do falso Duque é descartada
      emitWarningLog(`${this.challengerPlayer.name} não revela um duque e perde uma carta.`,this.gameState.getNamespace())
      this.gameState.discardPlayerCard(dukeCardUUID, this.challengerPlayer!);

      emitActionLog(`${this.challengerPlayer.name} descarta um ${revealedCard.name}.`,this.gameState.getNamespace())
      // A ação de auxílio externo volta a valer
      this.currentPlayer.addCoins(2);
      
      console.debug(`Contestação bem-sucedida! ${this.currentPlayer.name} recebe 2 moedas.`);
      emitActionLog(`Contestação de ${this.currentPlayer.name} foi bem-sucedida e recebe 2 moedas. }`,this.gameState.getNamespace())
    } else {
      // Duque era verdadeiro — contra-contestador perde carta
      const cardUUID = await this.promptService.askSingleCard(this.currentPlayer);

      this.gameState.discardPlayerCard(cardUUID, this.currentPlayer);

      // Duque revela e troca carta
      this.gameState.placeCardIntoDeckAndReceiveAnother(revealedCard.uuid, this.challengerPlayer!);
      emitActionLog(`${this.challengerPlayer.name} revela um Duque, então ${this.currentPlayer.name} não recebe auxílio e perde uma carta.`,this.gameState.getNamespace())

      console.debug(`Contestação ao Duque falhou. ${this.currentPlayer.name} não recebe moedas.`);
    }
  }
}
