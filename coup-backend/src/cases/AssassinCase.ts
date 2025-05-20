/* eslint-disable no-console */
import Case from './Case.ts';
import Player from '../core/entities/Player.ts';
import { CARD_VARIANT_ASSASSIN, CARD_VARIANT_CONDESSA } from '../constants/cardVariants.ts';
import { PROMPT_OPTION_CHALLENGE_ACCEPT, PROMPT_OPTION_CHALLENGE_PASS } from '../constants/promptOptions.ts';
import GameState from '../core/GameState.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';
import { Namespace } from 'socket.io';

export default class AssassinCase extends Case {
  private targetPlayer!: Player;

  constructor(gameState: GameState) {
    super('Kill', gameState);
  }

  public canExecute(): boolean {
    return this.gameState.getCurrentTurnPlayer().getCoinsAmount() >= 3 && super.canExecute();
  }

  public async runCase(): Promise<void> {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    this.verifyCoins();
    this.payCoins();

    
    await this.promptChooseTarget();
    
    emitActionLog(`${this.currentPlayer.name}: Sou o assassino e quero matar ${this.targetPlayer.name}.`,this.gameState.getNamespace())

    const defenseChoice = await this.promptTargetDefense();

    console.log(`Defense choice ${defenseChoice}`);

    if (defenseChoice === 'ACCEPT') {
      emitActionLog(`${this.targetPlayer.name}: Aceito o assassinato e perco uma carta.`,this.gameState.getNamespace())
      await this.applyAssassination();
    } else if (defenseChoice === 'BLOCK') {
      emitActionLog(`${this.targetPlayer.name}: Sou a condessa e bloqueio o assassinato. `,this.gameState.getNamespace())
      await this.handleCondessaBlock();
    } else {
      emitActionLog(`${this.targetPlayer.name}: Contesto o assassinato. `,this.gameState.getNamespace())
      await this.handleClaimChallenge();
    }

    this.finishTurn();
  }

  private verifyCoins(): void {
    if (this.currentPlayer.getCoinsAmount() < 3) {
      throw new Error('Você precisa ter pelo menos 3 moedas para assassinar.');
    }
  }

  private payCoins(): void {
    console.debug(`${this.currentPlayer.name} paga 3 moedas para assassinar.`);
    this.currentPlayer.removeCoins(3);
  }

  private async promptChooseTarget(): Promise<void> {
    const options = this.gameState
      .getActivePlayers()
      .filter((p) => p.uuid !== this.currentPlayer.uuid)
      .map((p) => ({ label: p.name, value: p.uuid }));

    const chosenUuid: string = await this.promptService.prompt(
      this.currentPlayer.socket,
      'Escolha um jogador para assassinar',
      options,
      options[0].value,
    );

    console.log(`Chosen target: ${chosenUuid}`);

    const target = this.gameState.getPlayerByUUID(chosenUuid);
    if (!target) throw new Error('Jogador alvo não encontrado.');
    this.targetPlayer = target;
  }

  private async promptTargetDefense(): Promise<string> {
    const options = [
      { label: 'Aceitar assassinato', value: 'ACCEPT' },
      { label: 'Desafiar', value: PROMPT_OPTION_CHALLENGE_ACCEPT },
      { label: 'Dizer que é a Condessa', value: 'BLOCK' },
    ];

    return this.promptService.prompt(
      this.targetPlayer.socket,
      `${this.currentPlayer.name} está tentando te assassinar. O que você deseja fazer?`,
      options,
      options[0].value,
    );
  }

  private async applyAssassination(): Promise<void> {
    const uuid = await this.promptService.askSingleCard(this.targetPlayer);
    const discardedUuid = this.targetPlayer.getCardByUUID(uuid);

    console.log(`Discarding card ${uuid} from player ${this.targetPlayer.name}`);
    emitActionLog(`${this.targetPlayer.name} descartou um ${discardedUuid.name} `,this.gameState.getNamespace())
    this.gameState.discardPlayerCard(uuid, this.targetPlayer);
  }

  private async handleCondessaBlock(): Promise<void> {
    const options = [
      {
        label: 'Contestar',
        value: PROMPT_OPTION_CHALLENGE_ACCEPT,
      },
      {
        label: 'Passar',
        value: PROMPT_OPTION_CHALLENGE_PASS,
      },
    ];

    const response = await this.promptService.prompt(
      this.currentPlayer.socket,
      `${this.targetPlayer.name} diz ser a Condessa e bloqueia o assassinato. O que deseja fazer`,
      options,
      options[0].value,
    );

    if (response === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      console.log('Challenge accepted');
      emitActionLog(`${this.currentPlayer.name}: Contesto a condessa. `,this.gameState.getNamespace())

      await this.handleBlockChallenge();
    } else {
      emitActionLog(`${this.currentPlayer.name}: Não contesto a condessa e passo a vez.`,this.gameState.getNamespace())
      console.log('Challenge not accepted, doing nothing and moving to the next turn.');
    }
  }

  private async handleBlockChallenge(): Promise<void> {
    // Target reveals a card
    const revealedUuid = await this.promptService.askSingleCard(this.targetPlayer);

    const revealed = this.targetPlayer.getCardByUUID(revealedUuid);

    if (revealed.variant === CARD_VARIANT_CONDESSA) {
      console.log('The card is Consessa');
      emitWarningLog(`${this.targetPlayer.name} Era a condessa e e ${this.currentPlayer.name} perde uma carta. `,this.gameState.getNamespace())
   
      const chosenCardUuid = await this.promptService.askSingleCard(this.currentPlayer);

      this.gameState.discardPlayerCard(chosenCardUuid, this.currentPlayer);

      this.gameState.placeCardIntoDeckAndReceiveAnother(revealedUuid, this.targetPlayer);
    } else {
      console.log('The card is not Consessa');
      emitWarningLog(`${this.targetPlayer.name} não era a condessa e sofre PERCA DUPLA DE INFLUENCIA`, this.gameState.getNamespace())
      // Block failed: target loses both cards
      this.discardAllTargetPlayerCards();
    }
  }

  private discardAllTargetPlayerCards() {
    const cards = this.targetPlayer.getCards();

    cards.forEach((card) => {
      this.gameState.discardPlayerCard(card.uuid, this.targetPlayer);
    });
  }

  private async handleClaimChallenge(): Promise<void> {
    // Current player reveals a card
    const revealUuid = await this.promptService.askSingleCard(this.currentPlayer);

    const revealedCard = this.currentPlayer.getCardByUUID(revealUuid);

    if (revealedCard.variant === CARD_VARIANT_ASSASSIN) {
      // Challenge failed: challenger loses one card and current player exchanges Assassin
      emitWarningLog(`${this.currentPlayer.name} Era o assassino e ${this.targetPlayer.name} sofre PERCA DUPLA DE INFLUENCIA !.`,this.gameState.getNamespace())
      this.discardAllTargetPlayerCards();

      this.gameState.placeCardIntoDeckAndReceiveAnother(revealUuid, this.currentPlayer);
    } else {
      const discardedUuid = this.currentPlayer.getCardByUUID(revealUuid);
      this.gameState.discardPlayerCard(revealUuid, this.currentPlayer);
      emitWarningLog(`${this.currentPlayer.name} não tinha o assassino descartou um ${discardedUuid.name}`, this.gameState.getNamespace())
    }
  }
}
