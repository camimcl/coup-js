/* eslint-disable no-console */
import { CARD_VARIANT_AMBASSADOR, CARD_VARIANT_CAPTAIN } from '../constants/cardVariants.ts';
import { PROMPT_OPTION_CHALLENGE_ACCEPT, PROMPT_OPTION_CHALLENGE_PASS } from '../constants/promptOptions.ts';
import Player from '../core/entities/Player.ts';
import GameState from '../core/GameState.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';
import Case from './Case.ts';

const DEFENSE_RESPONSE_ACCEPT = 'ACCEPT';
const DEFENSE_RESPONSE_BLOCK_AS_CAPTAIN = 'BLOCK_AS_CAPTAIN';
const DEFENSE_RESPONSE_BLOCK_AS_EMBASSADOR = 'BLOCK_AS_EMBASSADOR';

type DEFENSE_RESPONSE = typeof PROMPT_OPTION_CHALLENGE_ACCEPT
  | typeof DEFENSE_RESPONSE_ACCEPT
  | typeof DEFENSE_RESPONSE_BLOCK_AS_CAPTAIN
  | typeof DEFENSE_RESPONSE_BLOCK_AS_EMBASSADOR;

export default class CaptainCase extends Case {
  private targetPlayer!: Player;

  constructor(gameState: GameState) {
    super('Steal Two Coins', gameState);
  }

  public canExecute(): boolean {
    const players = this.gameState.getActivePlayers();

    return players.some((p) => p.getCoinsAmount() >= 2) && super.canExecute();
  }

  public async runCase() {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    await this.promptChooseTarget();

    emitActionLog(`${this.currentPlayer.name}: Sou o capitão e quero 2 moedas de ${this.targetPlayer.name}. `,this.gameState.getNamespace())
    const defenseChoice = await this.promptTargetDefense();

    if (defenseChoice === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      emitActionLog(`${this.targetPlayer.name}: Contesto o Capitão. `,this.gameState.getNamespace())
      await this.handleClaimChallenge();
    } else if (defenseChoice === DEFENSE_RESPONSE_ACCEPT) {
      this.doRobbery();
      emitActionLog(`${this.targetPlayer.name}: Aceito o roubo e perco 2 moedas `,this.gameState.getNamespace())
    } else if (defenseChoice === DEFENSE_RESPONSE_BLOCK_AS_EMBASSADOR) {
      await this.handleTargetDefense(CARD_VARIANT_AMBASSADOR);
      emitActionLog(`${this.targetPlayer.name}: Sou o embaixador e não serei roubado. `,this.gameState.getNamespace())
    } else if (defenseChoice === DEFENSE_RESPONSE_BLOCK_AS_CAPTAIN) {
      emitActionLog(`${this.targetPlayer.name}: Sou o capitão e não serei roubado. `,this.gameState.getNamespace())
      await this.handleTargetDefense(CARD_VARIANT_CAPTAIN);
    }

    this.finishTurn();
  }

  doRobbery() {
    this.targetPlayer.removeCoins(2);

    this.currentPlayer.addCoins(2);
  }

  async handleTargetDefense(
    chosenInfluence: (typeof CARD_VARIANT_CAPTAIN | typeof CARD_VARIANT_AMBASSADOR),
  ) {
    const influenceLabel = chosenInfluence === CARD_VARIANT_CAPTAIN ? 'Capitão' : 'Embaixador';

    const currentPlayerResponse = await this.promptService.challengePlayer(
      this.currentPlayer.socket,
      `${this.targetPlayer.name} diz ser o ${influenceLabel}. Deseja contestar?`,
    );

    if (currentPlayerResponse === PROMPT_OPTION_CHALLENGE_PASS) {
      emitActionLog(`${this.currentPlayer.name}: Não contesto o ${influenceLabel} e passo a vez.`,this.gameState.getNamespace())
      return;
    }

    const revealedCardUUID = await this.promptService.askSingleCard(this.targetPlayer);

    const card = this.targetPlayer.getCardByUUID(revealedCardUUID);

    if (card.variant === chosenInfluence) {
      emitActionLog(`${this.targetPlayer.name} era o ${influenceLabel} e ${this.currentPlayer} perde uma carta.`,this.gameState.getNamespace())
      const cardUUID = await this.promptService.askSingleCard(this.currentPlayer);
      const discardedUuid = this.targetPlayer.getCardByUUID(cardUUID);

      this.gameState.discardPlayerCard(cardUUID, this.currentPlayer);
      emitWarningLog(`${this.currentPlayer.name} Descartou ${discardedUuid}.`,this.gameState.getNamespace())
      
      this.gameState.placeCardIntoDeckAndReceiveAnother(revealedCardUUID, this.targetPlayer);
    } else {
      this.gameState.discardPlayerCard(revealedCardUUID, this.targetPlayer);
      const revealedCard = this.targetPlayer.getCardByUUID(revealedCardUUID);
      emitWarningLog(`${this.targetPlayer.name} Não era o ${influenceLabel} e descarta ${revealedCard}.`,this.gameState.getNamespace())

    }
  }

  async handleClaimChallenge() {
    const chosenCardUUID = await this.promptService.askSingleCard(this.currentPlayer);

    const chosenCard = this.currentPlayer.getCardByUUID(chosenCardUUID);

    if (chosenCard?.variant === CARD_VARIANT_CAPTAIN) {
      await this.handleTargetPlayerChallengeLoss();
      
      this.gameState.placeCardIntoDeckAndReceiveAnother(chosenCardUUID, this.currentPlayer);
      emitWarningLog(`${this.currentPlayer.name} Era o capitão e ${this.targetPlayer.name} perde 2 moedas. `,this.gameState.getNamespace())
      this.doRobbery();
    } else {
      const discardedUuid = this.targetPlayer.getCardByUUID(chosenCardUUID)
      this.gameState.discardPlayerCard(chosenCardUUID, this.currentPlayer);
      emitWarningLog(`${this.currentPlayer.name} Não era o capitão e descartou um ${discardedUuid.name}. `,this.gameState.getNamespace())
    }
  }

  async handleTargetPlayerChallengeLoss() {
    const chosenCardUUID = await this.promptService.askSingleCard(this.targetPlayer);

    this.gameState.discardPlayerCard(chosenCardUUID, this.targetPlayer);
  }

  private async promptChooseTarget(): Promise<void> {
    const options = this.gameState
      .getActivePlayers()
      .filter((p) => p.uuid !== this.currentPlayer.uuid && p.getCoinsAmount() >= 2)
      .map((p) => ({ label: p.name, value: p.uuid }));

    if (options.length === 0) {
      throw new Error('No player has two coins');
    }

    const chosenUuid: string = await this.promptService.prompt(
      this.currentPlayer.socket,
      'Escolha um jogador para roubar',
      options,
      options[0].value,
    );

    const target = this.gameState.getPlayerByUUID(chosenUuid);

    if (!target) throw new Error('Jogador alvo não encontrado.');

    this.targetPlayer = target;

    console.debug(`Chosen target: ${target.name}`);
  }

  private async promptTargetDefense(): Promise<DEFENSE_RESPONSE> {
    const options = [
      { label: 'Aceitar roubo', value: DEFENSE_RESPONSE_ACCEPT },
      { label: 'Desafiar', value: PROMPT_OPTION_CHALLENGE_ACCEPT },
      { label: 'Defender-se como capitao', value: DEFENSE_RESPONSE_BLOCK_AS_CAPTAIN },
      { label: 'Defender-se como Embassador', value: DEFENSE_RESPONSE_BLOCK_AS_EMBASSADOR },
    ];

    return await this.promptService.prompt(
      this.targetPlayer.socket,
      `${this.currentPlayer.name} está tentando te roubar. O que você deseja fazer?`,
      options,
      options[0].value,
    ) as DEFENSE_RESPONSE;
  }
}
