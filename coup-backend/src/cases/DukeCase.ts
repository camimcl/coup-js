/* eslint-disable no-console */
import { PROMPT_OPTION_CHALLENGE_ACCEPT } from '../constants/promptOptions.ts';
import { CARD_VARIANT_DUKE } from '../constants/cardVariants.ts';
import Player from '../core/entities/Player.ts';
import Case from './Case.ts';
import GameState from '../core/GameState.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';

export default class DukeCase extends Case {
  private challengerPlayer: Player | null = null;

  constructor(gameState: GameState) {
    super('Tax', gameState);
  }

  async runCase() {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    const {
      challengerId,
      response: challengeResolution,
    } = await this.promptService.challengeOthers(
      this.currentPlayer.socket,
      this.gameState.getActivePlayers().length,
      `${this.currentPlayer.name} diz ser o Duque e requisita três moedas.`,
    );

    if (challengeResolution === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      await this.handleChallenge(challengerId);
    } else {
      console.debug(`${this.currentPlayer.name} has won 3 coins because no one challenged them as Duke`);
      emitWarningLog(`Ninguém contestou o Duque de ${this.currentPlayer.name}, e ele recebe 3 moedas.`,this.gameState.getNamespace())

      this.currentPlayer.addCoins(3);

      console.debug(`Now ${this.currentPlayer.name} has ${this.currentPlayer.getCoinsAmount()} coins`);
    }
    this.finishTurn();
  }

  private async handleChallenge(challengerId: string) {
    this.challengerPlayer = this.gameState.getPlayerByUUID(challengerId);

    if (!this.challengerPlayer) {
      throw new Error('Player was not found. Finishing game');
    }

    console.debug(`${this.challengerPlayer.name} has challenged ${this.currentPlayer.name}`);
    emitActionLog(`${this.challengerPlayer.name} desafiou o Duque de ${this.currentPlayer.name}. `,this.gameState.getNamespace())

    console.debug(`${this.currentPlayer.name} must choose a card`);

    const currentPlayerChosenCardUUID = await this.promptService.askSingleCard(this.currentPlayer);

    const chosenCard = this.currentPlayer.getCardByUUID(currentPlayerChosenCardUUID);

    if (chosenCard.variant !== CARD_VARIANT_DUKE) {
      console.debug('The chosen card is not Duke. Discarding the chosen card.');
      emitWarningLog(`${this.currentPlayer.name} Não tinha o duque e perde uma carta. `,this.gameState.getNamespace())
      this.gameState.discardPlayerCard(currentPlayerChosenCardUUID, this.currentPlayer);

      return;
    }
    emitWarningLog(`${this.currentPlayer.name} tinha o duque, entao ${this.challengerPlayer.name} perde uma carta. `,this.gameState.getNamespace())
    console.debug(`The chosen card is Duke. The challenger player ${this.challengerPlayer.name} must choose a card to discard.`);

    const challengerChosenCardUUID = await this.promptService.askSingleCard(this.challengerPlayer);
    const discardedUuid = this.challengerPlayer.getCardByUUID(challengerChosenCardUUID);

    emitWarningLog(`${this.challengerPlayer.name} descartou um ${discardedUuid.name}`, this.gameState.getNamespace())
    console.debug('Discarding the chosen card.');

    this.gameState.discardPlayerCard(challengerChosenCardUUID, this.challengerPlayer);

    emitWarningLog(`${this.currentPlayer.name} recebe uma nova carta.`, this.gameState.getNamespace())
    console.debug(`${this.currentPlayer.name} receives a new card and discard the Duke card`);

    this.gameState.placeCardIntoDeckAndReceiveAnother(chosenCard.uuid, this.currentPlayer);

    console.debug(`Performing the Duke action and giving 3 coins to ${this.currentPlayer.name}`);

    this.currentPlayer.addCoins(3);
    console.debug(`Now ${this.currentPlayer.name} has ${this.currentPlayer.getCoinsAmount()} coins`);
  }
}
