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
 * Event payload for when a player is assigned to a team
 */
@serializable()
export class PlayerTeamAssignedPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly team: Team = Team.Red;
  public readonly redTeamCount: number = 0;
  public readonly blueTeamCount: number = 0;
}

/**
 * NETWORK EVENT - Broadcasts team assignments to all clients
 */
export const PlayerTeamAssignedNetworkEvent = new NetworkEvent(
  "PlayerTeamAssignedNetwork",
  PlayerTeamAssignedPayload
);

/**
 * Event payload for when a player leaves a team
 */
@serializable()
export class PlayerTeamRemovedPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly team: Team = Team.Red;
  public readonly redTeamCount: number = 0;
  public readonly blueTeamCount: number = 0;
}

/**
 * NETWORK EVENT - Broadcasts team removals to all clients
 */
export const PlayerTeamRemovedNetworkEvent = new NetworkEvent(
  "PlayerTeamRemovedNetwork",
  PlayerTeamRemovedPayload
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

    // BROADCAST team assignment to ALL clients (including self)
    this.entity.sendEventToEveryone(PlayerTeamAssignedNetworkEvent, {
      playerEntity: player,
      team: assignedTeam,
      redTeamCount: TeamManager.redTeamCount,
      blueTeamCount: TeamManager.blueTeamCount,
    });
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

      // BROADCAST team removal to ALL clients (including self)
      this.entity.sendEventToEveryone(PlayerTeamRemovedNetworkEvent, {
        playerEntity: player,
        team: team,
        redTeamCount: TeamManager.redTeamCount,
        blueTeamCount: TeamManager.blueTeamCount,
      });
    } else {
      console.log(
        `❓ TeamManager [AUTHORITY]: Player ${player.debugId} left but was not assigned to any team`
      );
    }
  }

  /**
   * ALL CLIENTS - Receive team assignment from authority
   * This runs on ALL clients when a player is assigned to a team
   */
  @subscribe(PlayerTeamAssignedNetworkEvent, {
    execution: Execution.Everywhere,
  })
  onPlayerTeamAssigned(payload: PlayerTeamAssignedPayload) {
    if (!payload.playerEntity) {
      console.log("❌ TeamManager: Invalid player entity in team assignment");
      return;
    }

    console.log(
      `🌐 TeamManager [ALL CLIENTS]: Player ${payload.playerEntity.debugId} assigned to ${payload.team} team`
    );

    // Update local state on ALL clients
    TeamManager.playerTeams.set(payload.playerEntity, payload.team);
    TeamManager.redTeamCount = payload.redTeamCount;
    TeamManager.blueTeamCount = payload.blueTeamCount;

    console.log(
      `📊 TeamManager [ALL CLIENTS]: Updated team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );
  }

  /**
   * ALL CLIENTS - Receive team removal from authority
   * This runs on ALL clients when a player leaves a team
   */
  @subscribe(PlayerTeamRemovedNetworkEvent, { execution: Execution.Everywhere })
  onPlayerTeamRemoved(payload: PlayerTeamRemovedPayload) {
    if (!payload.playerEntity) {
      console.log("❌ TeamManager: Invalid player entity in team removal");
      return;
    }

    console.log(
      `🌐 TeamManager [ALL CLIENTS]: Player ${payload.playerEntity.debugId} removed from ${payload.team} team`
    );

    // Update local state on ALL clients
    TeamManager.playerTeams.delete(payload.playerEntity);
    TeamManager.redTeamCount = payload.redTeamCount;
    TeamManager.blueTeamCount = payload.blueTeamCount;

    console.log(
      `📊 TeamManager [ALL CLIENTS]: Updated team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
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
