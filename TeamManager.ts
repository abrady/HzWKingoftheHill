import {
  component,
  Component,
  OnEntityStartEvent,
  subscribe,
  OnPlayerCreateEvent,
  OnPlayerCreateEventPayload,
  OnPlayerDestroyEvent,
  OnPlayerDestroyEventPayload,
  NetworkEvent,
  serializable,
  type IEntity,
  Execution,
} from "meta/platform_api@index";
import { console } from "meta/scripting_jsi@native_objects/Console";

/**
 * Enum representing the available teams
 */
export enum Team {
  Red = "red",
  Blue = "blue",
}

/**
 * Event payload containing complete team makeup
 * Recipients can use their own entity debugId to determine which team they belong to
 */
@serializable()
export class TeamAssignmentPayload {
  public readonly redTeamPlayers: readonly string[] = [];
  public readonly blueTeamPlayers: readonly string[] = [];
  public readonly redTeamCount: number = 0;
  public readonly blueTeamCount: number = 0;
}

/**
 * NETWORK EVENT - Broadcasts complete team assignments to all clients
 * NOTE: Requires NetworkedEntityComponent on the entity using this event
 */
export const TeamAssignmentNetworkEvent = new NetworkEvent(
  "TeamAssignmentNetwork",
  TeamAssignmentPayload
);

/**
 * Global Team Manager - handles all team assignments consistently across the game.
 * This should be a singleton component attached to a persistent entity in your scene.
 */
@component()
export class TeamManager extends Component {
  // Global team assignments - maps player entity to team
  private static playerTeams: Map<IEntity, Team> = new Map();

  // Team player counts for balancing
  private static redTeamCount: number = 0;
  private static blueTeamCount: number = 0;

  // Singleton reference for global access
  private static instance: TeamManager | null = null;

  @subscribe(OnEntityStartEvent)
  onStart() {
    // Set up singleton instance
    TeamManager.instance = this;
    console.log("🎮 TeamManager: Global team management system initialized");
    console.log(
      `📊 TeamManager: Current teams - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );
    console.log(`🔍 TeamManager: Entity is owned: ${this.entity.isOwned()}`);
    console.log(`🔍 TeamManager: Entity debugId: ${this.entity.debugId}`);
  }

  /**
   * AUTHORITY ONLY - Listen for player joining the world
   * Only the owner/server makes team assignment decisions
   */
  @subscribe(OnPlayerCreateEvent, { execution: Execution.Owner })
  onPlayerJoined(event: OnPlayerCreateEventPayload) {
    if (!event.entity) {
      console.log("❌ TeamManager: Player joined but no entity provided");
      return;
    }

    // Double-check we're the authority
    if (!this.entity.isOwned()) {
      console.log("⚠️ TeamManager: Not authority, ignoring player join");
      return;
    }

    const player = event.entity;
    console.log(
      `👋 TeamManager [AUTHORITY]: Player joined - Entity ID: ${player.debugId}`
    );

    // SERVER makes balanced team assignment decision
    const assignedTeam = this.assignPlayerToTeamWithBalancing(player);

    console.log(
      `🎭 TeamManager [AUTHORITY]: Player ${player.debugId} assigned to ${assignedTeam} team`
    );
    console.log(
      `📊 TeamManager [AUTHORITY]: Team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );

    // BROADCAST complete team assignment to ALL clients (including self)
    this.broadcastCompleteTeamAssignment();
  }

  /**
   * AUTHORITY ONLY - Listen for player leaving the world
   * Only the owner/server makes team removal decisions
   */
  @subscribe(OnPlayerDestroyEvent, { execution: Execution.Owner })
  onPlayerLeft(event: OnPlayerDestroyEventPayload) {
    if (!event.entity) {
      console.log("❌ TeamManager: Player left but no entity provided");
      return;
    }

    // Double-check we're the authority
    if (!this.entity.isOwned()) {
      console.log("⚠️ TeamManager: Not authority, ignoring player leave");
      return;
    }

    const player = event.entity;
    const team = TeamManager.playerTeams.get(player);

    if (team) {
      console.log(
        `👋 TeamManager [AUTHORITY]: Player ${player.debugId} left from ${team} team`
      );

      // SERVER removes player from team
      this.removePlayerFromTeamWithBalancing(player);

      console.log(
        `📊 TeamManager [AUTHORITY]: Team counts after leave - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
      );

      // BROADCAST complete team assignment to ALL clients (including self)
      this.broadcastCompleteTeamAssignment();
    } else {
      console.log(
        `❓ TeamManager [AUTHORITY]: Player ${player.debugId} left but was not assigned to any team`
      );
    }
  }

  /**
   * ALL CLIENTS - Receive complete team assignment update from authority
   * This runs on ALL clients when team assignments change
   * Recipients can use their own EntityId to determine which team they belong to
   */
  @subscribe(TeamAssignmentNetworkEvent, { execution: Execution.Everywhere })
  onTeamAssignmentUpdate(payload: TeamAssignmentPayload) {
    console.log(
      `🌐 TeamManager [ALL CLIENTS]: Received complete team assignment update`
    );

    // Clear and rebuild team assignments from complete team lists
    TeamManager.playerTeams.clear();

    // Rebuild red team assignments
    for (const playerId of payload.redTeamPlayers) {
      const playerEntity = this.getEntityById(playerId);
      if (playerEntity) {
        TeamManager.playerTeams.set(playerEntity, Team.Red);
      }
    }

    // Rebuild blue team assignments
    for (const playerId of payload.blueTeamPlayers) {
      const playerEntity = this.getEntityById(playerId);
      if (playerEntity) {
        TeamManager.playerTeams.set(playerEntity, Team.Blue);
      }
    }

    // Update team counts
    TeamManager.redTeamCount = payload.redTeamCount;
    TeamManager.blueTeamCount = payload.blueTeamCount;

    console.log(
      `📊 TeamManager [ALL CLIENTS]: Updated team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );
    console.log(
      `🎭 TeamManager [ALL CLIENTS]: Red team has ${payload.redTeamPlayers.length} players, Blue team has ${payload.blueTeamPlayers.length} players`
    );
  }

  /**
   * AUTHORITY ONLY - Assign a player to a team with automatic balancing
   */
  private assignPlayerToTeamWithBalancing(player: IEntity): Team {
    let assignedTeam: Team;

    // Assign to team with fewer players (balancing)
    if (TeamManager.redTeamCount <= TeamManager.blueTeamCount) {
      assignedTeam = Team.Red;
      TeamManager.redTeamCount++;
    } else {
      assignedTeam = Team.Blue;
      TeamManager.blueTeamCount++;
    }

    // Store the assignment (authority only)
    TeamManager.playerTeams.set(player, assignedTeam);

    return assignedTeam;
  }

  /**
   * AUTHORITY ONLY - Remove a player from their team with balancing update
   */
  private removePlayerFromTeamWithBalancing(player: IEntity): void {
    const team = TeamManager.playerTeams.get(player);

    if (team === Team.Red) {
      TeamManager.redTeamCount = Math.max(0, TeamManager.redTeamCount - 1);
    } else if (team === Team.Blue) {
      TeamManager.blueTeamCount = Math.max(0, TeamManager.blueTeamCount - 1);
    }

    // Remove from registry (authority only)
    TeamManager.playerTeams.delete(player);
  }

  /**
   * AUTHORITY ONLY - Broadcast complete team assignment to all clients
   */
  private broadcastCompleteTeamAssignment(): void {
    const redTeamPlayers: string[] = [];
    const blueTeamPlayers: string[] = [];

    // Build complete team lists with debugIds
    for (const [player, team] of TeamManager.playerTeams.entries()) {
      const debugId = player.debugId;
      if (team === Team.Red) {
        redTeamPlayers.push(debugId);
      } else if (team === Team.Blue) {
        blueTeamPlayers.push(debugId);
      }
    }

    console.log(
      `📡 TeamManager [AUTHORITY]: Broadcasting complete team assignment - Red: ${redTeamPlayers.length}, Blue: ${blueTeamPlayers.length}`
    );

    // Send complete team assignment to ALL clients
    this.entity.sendEventToEveryone(TeamAssignmentNetworkEvent, {
      redTeamPlayers: redTeamPlayers,
      blueTeamPlayers: blueTeamPlayers,
      redTeamCount: TeamManager.redTeamCount,
      blueTeamCount: TeamManager.blueTeamCount,
    });
  }

  /**
   * Get IEntity from debugId
   * This is a simplified implementation - in practice, you might need a more robust entity lookup
   */
  private getEntityById(debugId: string): IEntity | null {
    // Look through current player assignments to find matching entity
    for (const player of TeamManager.playerTeams.keys()) {
      if (player.debugId === debugId) {
        return player;
      }
    }
    return null;
  }

  /**
   * GLOBAL STATIC METHODS - Use these from other components
   */

  /**
   * Get a player's team assignment
   */
  public static getPlayerTeam(player: IEntity): Team | null {
    return TeamManager.playerTeams.get(player) || null;
  }

  /**
   * Get all players on a specific team
   */
  public static getPlayersOnTeam(team: Team): IEntity[] {
    const players: IEntity[] = [];
    for (const [player, playerTeam] of TeamManager.playerTeams.entries()) {
      if (playerTeam === team) {
        players.push(player);
      }
    }
    return players;
  }

  /**
   * Get current team counts
   */
  public static getTeamCounts(): { red: number; blue: number } {
    return {
      red: TeamManager.redTeamCount,
      blue: TeamManager.blueTeamCount,
    };
  }

  /**
   * Get all current team assignments
   */
  public static getAllTeamAssignments(): Map<IEntity, Team> {
    return new Map(TeamManager.playerTeams);
  }

  /**
   * Get a player's team assignment by debugId
   * Useful for recipients to check which team they belong to using their own entity debugId
   */
  public static getPlayerTeamByDebugId(debugId: string): Team | null {
    // Find the player entity with the matching debugId
    for (const [player, team] of TeamManager.playerTeams.entries()) {
      if (player.debugId === debugId) {
        return team;
      }
    }
    return null;
  }

  /**
   * Manual team assignment (for admin/debug purposes)
   */
  public static assignPlayerToSpecificTeam(
    player: IEntity,
    team: Team
  ): boolean {
    const currentTeam = TeamManager.playerTeams.get(player);

    // Remove from current team if assigned
    if (currentTeam === Team.Red) {
      TeamManager.redTeamCount = Math.max(0, TeamManager.redTeamCount - 1);
    } else if (currentTeam === Team.Blue) {
      TeamManager.blueTeamCount = Math.max(0, TeamManager.blueTeamCount - 1);
    }

    // Assign to new team
    TeamManager.playerTeams.set(player, team);
    if (team === Team.Red) {
      TeamManager.redTeamCount++;
    } else {
      TeamManager.blueTeamCount++;
    }

    console.log(
      `🔄 TeamManager: Manually assigned player ${player.debugId} to ${team} team`
    );
    console.log(
      `📊 TeamManager: Updated team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );

    // Broadcast the updated team assignment if we have an instance
    if (TeamManager.instance) {
      TeamManager.instance.broadcastCompleteTeamAssignment();
    }

    return true;
  }

  /**
   * Check if the TeamManager is initialized
   */
  public static isInitialized(): boolean {
    return TeamManager.instance !== null;
  }

  /**
   * Get the singleton instance (for advanced use cases)
   */
  public static getInstance(): TeamManager | null {
    return TeamManager.instance;
  }
}
