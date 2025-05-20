/* eslint-disable no-console */
import { Namespace, Server } from 'socket.io';
import EventEmitter from 'events';
import Player from './entities/Player.ts';
import GameState from './GameState.ts';
import { GAME_END, GAME_START, MATCH_STATE_UPDATE, PLAYER_COUNT_UPDATE } from '../constants/events.ts';

const MINIMUM_NUMBER_OF_PLAYERS = 4;
const MAXIMUM_NUMBER_OF_PLAYERS = 8;

// Utility function to generate a 10-character alphanumeric ID
export function generateShortUUID(): string {
  // Converting to upper case because we're using a font on the frontend
  // that only shows uppercase letters.
  return Math.random().toString(36).substring(2, 12).toUpperCase();
}

export default class Match {
  private uuid: string;

  private players: Player[];

  private hasEnded: boolean = false;

  private inProgress: boolean = false;

  private winner: string | null = null;

  private hostUUID: string;

  private gameState: GameState;

  /** Socket.IO namespace dedicated to this match. */
  private namespace: Namespace;

  readonly internalBus: EventEmitter;

  constructor(internalBus: EventEmitter, players: Player[], server: Server) {
    this.players = players;
    this.uuid = generateShortUUID();
    this.namespace = server.of(`/${this.uuid}`);
    this.hostUUID = players[0]?.uuid || '';
    this.internalBus = internalBus;
    this.gameState = new GameState(internalBus, this.namespace, this.players);

    this.internalBus.on(GAME_END, (winner: string) => {
      this.winner = winner;
      this.hasEnded = true;
      this.inProgress = false;

      this.emitMatchState();
    });
  }

  public startMatch() {
    if (this.inProgress) {
      console.debug(`Match ${this.uuid} is already is progress`);

      return;
    }

    if (this.players.length < MINIMUM_NUMBER_OF_PLAYERS) {
      console.debug(`Cannot start match ${this.uuid}: not enough players`);

      return;
    }

    console.debug(`Starting match ${this.uuid}`);

    this.gameState.startGame();

    this.inProgress = true;

    this.internalBus.emit(GAME_START);

    this.namespace.emit(GAME_START);

    this.emitMatchState();
  }

  addPlayer(player: Player) {
    // TODO: send events to the client saying it's not possible to join this match
    if (this.hasEnded) {
      console.warn('Cannot add player: match has already ended.');
    }

    if (this.inProgress) {
      console.warn('Cannot add player: match is already in progress. No new players allowed.');
    }

    this.players.push(player);
    this.hostUUID = this.players[0].uuid;

    this.gameState.broadcastState();
    this.namespace.emit(PLAYER_COUNT_UPDATE, this.players.length);

    this.emitMatchState();
  }

  removePlayer(uuid: string): void {
    this.gameState.removePlayer(uuid);
    this.hostUUID = this.players[0]?.uuid || '';

    this.emitMatchState();
  }

  getUUID(): string {
    return this.uuid;
  }

  emitMatchState() {
    this.namespace.emit(MATCH_STATE_UPDATE, this.toJSONObject());
  }

  toJSONObject() {
    return {
      uuid: this.uuid,
      players: this.players.map((p) => p.getPublicProfile()),
      hostUUID: this.hostUUID,
      inProgress: this.inProgress,
      winner: this.winner
    };
  }

  getNamespace(): Namespace {
    return this.namespace;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  isInProgress(): boolean {
    return this.inProgress;
  }
}
