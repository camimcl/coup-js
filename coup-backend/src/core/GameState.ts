/* eslint-disable no-console */
import { Namespace } from 'socket.io';
import EventEmitter from 'events';
import Card from './entities/Card.ts';
import Player from './entities/Player.ts';
import Deck from './entities/Deck.ts';
import {
  CARD_DISCARDED,
  CARD_DRAW,
  GAME_END, GAME_STATE_UPDATE, TURN_START, PLACE_CARD_INTO_DECK,
  PLAYER_ELIMINATED,
} from '../constants/events.ts';
import { emitSystemLog } from '../utils/LogUtil.ts';
import { generateShortUUID } from './Match.ts';

export default class GameState {
  private currentTurnPlayerIndex: number = 0;

  private deck: Deck | null = null;

  private knownCards: Card[] = [];

  private players: Player[];

  private eliminatedPlayers: Player[] = [];

  public readonly uuid: string;

  private readonly namespace: Namespace;

  private readonly internalBus: EventEmitter;

  constructor(internalBus: EventEmitter, namespace: Namespace, players: Player[]) {
    this.namespace = namespace;
    this.players = players;
    this.deck = null; // Deck será criado apenas ao iniciar o jogo
    this.uuid = generateShortUUID();
    this.internalBus = internalBus;
  }

  public discardPlayerCard(cardUUID: string, player: Player): void {
    const discarded = player.removeCardByUUID(cardUUID);

    this.knownCards.push(discarded);

    player.socket.emit(CARD_DISCARDED, discarded);

    if (player.getCards().length === 0) {
      this.eliminatePlayer(player.uuid);
    }

    this.broadcastState();
  }

  public startGame() {
    // Cria o deck com a quantidade correta de jogadores
    this.deck = new Deck(this.players.length);
    this.dealInitialHands();

    this.broadcastState();

    emitSystemLog('Iniciando partida.', this.namespace);
  }

  public goToNextTurn(): void {
    if (this.players.length === 0) return;

    if (this.players.length === 1) {
      console.debug(`${this.players[0].name} won the match`);

      // Warns internal listeners that the match is over
      this.internalBus.emit(GAME_END, this.players[0]);

      // Warns clients that the match is over
      this.namespace.emit(GAME_END, this.players[0]);

      return;
    }

    this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.players.length;

    this.internalBus.emit(TURN_START);

    this.namespace.emit(TURN_START);

    this.broadcastState();

    emitSystemLog(`Iniciando Turno, vez de: ${this.players[this.currentTurnPlayerIndex].name}.`, this.namespace);
  }

  public drawCardForPlayer(player: Player): Card | null {
    if (!this.deck) throw new Error('Deck não foi inicializado.');
    const card = this.deck.draw();

    if (card) {
      player.addCard(card);

      this.namespace.emit(
        CARD_DRAW,
        { cardUUID: card.uuid, targetPlayerUUID: player.uuid },
      );

      this.broadcastState();

      return card;
    }

    return null;
  }

  public placeCardIntoDeckAndReceiveAnother(cardUUID: string, player: Player): void {
    if (!this.deck) throw new Error('Deck não foi inicializado.');
    this.placeCardIntoDeck(player.removeCardByUUID(cardUUID));

    this.drawCardForPlayer(player);

    this.broadcastState();
  }

  public placeCardIntoDeck(card: Card): void {
    if (!this.deck) throw new Error('Deck não foi inicializado.');
    this.deck.pushAndShuffle(card);

    // Warns everyone that a card was placed into the deck
    this.namespace.emit(
      PLACE_CARD_INTO_DECK,
      { cardUUID: card.uuid, originPlayerUUID: card.uuid },
    );
  }

  public eliminatePlayer(uuid: string): void {
    const [player] = this.players.filter((p) => p.uuid === uuid);

    if (!player) return;

    console.debug(`${player.name} has been eliminated`);

    emitSystemLog(`${player.name} foi eliminado.`, this.namespace);

    const index = this.players.findIndex((p) => p.uuid === uuid);

    this.currentTurnPlayerIndex -= 1;

    this.eliminatedPlayers.push(this.players.splice(index, 1)[0]);

    this.namespace.emit(
      PLAYER_ELIMINATED,
      { playerUUID: uuid },
    );

    this.broadcastState();
  }

  removePlayer(uuid: string) {
    const index = this.players.findIndex((p) => p.uuid === uuid);
    const wasCurrentTurn = index === this.currentTurnPlayerIndex;
    this.players.splice(index, 1);
    emitSystemLog(`Jogador removido da partida.`, this.namespace);
    // Ajusta o índice do jogador da vez
    if (index < this.currentTurnPlayerIndex) {
      this.currentTurnPlayerIndex -= 1;
    } else if (index === this.currentTurnPlayerIndex) {
      // Se o jogador removido era o da vez, não chama goToNextTurn, apenas mantém o índice
      if (this.currentTurnPlayerIndex >= this.players.length) {
        this.currentTurnPlayerIndex = 0;
      }
      // Emite manualmente o início do turno para o novo jogador da vez
      this.internalBus.emit(TURN_START);
      this.namespace.emit(TURN_START);
      this.broadcastState();
      return;
    }
    this.broadcastState();
  }

  private dealInitialHands(handSize: number = 2): void {
    if (!this.deck) throw new Error('Deck não foi inicializado.');
    emitSystemLog('Distribuindo cartas iniciais.', this.namespace);

    const totalCardsNeeded = this.players.length * handSize;

    if (this.deck.size() < totalCardsNeeded) {
      throw new Error('Not enough cards in the deck to deal initial hands.');
    }

    this.players.forEach((player) => {
      for (let i = 0; i < handSize; i++) {
        this.drawCardForPlayer(player);
      }
    });



    this.broadcastState();
  }

  public getCurrentTurnPlayer(): Player {
    return this.players[this.currentTurnPlayerIndex];
  }

  public getActivePlayers(): Player[] {
    return [...this.players];
  }

  public broadcastState(): void {
    this.namespace.emit(GAME_STATE_UPDATE, {
      uuid: this.uuid,
      players: this.players.map((p) => p.getPublicProfile()),
      eliminatedPlayers: this.eliminatedPlayers.map((p) => p.getPublicProfile()),
      currentTurnPlayer: this.getCurrentTurnPlayer()?.uuid,
      deckSize: this.deck ? this.deck.size() : 0,
      knownCards: this.knownCards,
    });
  }

  public getNamespace() {
    return this.namespace;
  }

  public getPlayerByUUID(uuid: string) {
    return this.players.filter((player) => player.uuid === uuid)[0];
  }
}
