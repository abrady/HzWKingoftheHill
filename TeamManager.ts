import {
  component,
  Component,
  OnEntityStartEvent,
  subscribe,
  OnPlayerCreateEvent,
  OnPlayerCreateEventPayload,
  OnPlayerDestroyEvent,
  OnPlayerDestroyEventPayload,
  EventService,
  LocalEvent,
  serializable,
  type IEntity,
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
  public readonly teamSize: number = 0;
}

/**
 * Event fired when a player is assigned to a team
 */
export const PlayerTeamAssignedEvent = new LocalEvent(
  "PlayerTeamAssigned",
  PlayerTeamAssignedPayload
);

/**
 * Event payload for when a player leaves a team
 */
@serializable()
export class PlayerTeamRemovedPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly team: Team = Team.Red;
  public readonly teamSize: number = 0;
}

/**
 * Event fired when a player leaves a team
 */
export const PlayerTeamRemovedEvent = new LocalEvent(
  "PlayerTeamRemoved",
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
   * Listen for player joining the world
   */
  @subscribe(OnPlayerCreateEvent)
  onPlayerJoined(event: OnPlayerCreateEventPayload) {
    if (!event.entity) {
      console.log("❌ TeamManager: Player joined but no entity provided");
      return;
    }

    const player = event.entity;
    console.log(`👋 TeamManager: Player joined - Entity ID: ${player.debugId}`);

    // Assign player to a team (with balancing)
    const assignedTeam = this.assignPlayerToTeam(player);

    console.log(
      `🎭 TeamManager: Player ${player.debugId} assigned to ${assignedTeam} team`
    );
    console.log(
      `📊 TeamManager: Team counts - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
    );

    // Broadcast team assignment event
    EventService.sendLocally(PlayerTeamAssignedEvent, {
      playerEntity: player,
      team: assignedTeam,
      teamSize:
        assignedTeam === Team.Red
          ? TeamManager.redTeamCount
          : TeamManager.blueTeamCount,
    });
  }

  /**
   * Listen for player leaving the world
   */
  @subscribe(OnPlayerDestroyEvent)
  onPlayerLeft(event: OnPlayerDestroyEventPayload) {
    if (!event.entity) {
      console.log("❌ TeamManager: Player left but no entity provided");
      return;
    }

    const player = event.entity;
    const team = TeamManager.playerTeams.get(player);

    if (team) {
      console.log(
        `👋 TeamManager: Player ${player.debugId} left from ${team} team`
      );

      // Remove from team
      this.removePlayerFromTeam(player);

      console.log(
        `📊 TeamManager: Team counts after leave - Red: ${TeamManager.redTeamCount}, Blue: ${TeamManager.blueTeamCount}`
      );

      // Broadcast team removal event
      EventService.sendLocally(PlayerTeamRemovedEvent, {
        playerEntity: player,
        team: team,
        teamSize:
          team === Team.Red
            ? TeamManager.redTeamCount
            : TeamManager.blueTeamCount,
      });
    } else {
      console.log(
        `❓ TeamManager: Player ${player.debugId} left but was not assigned to any team`
      );
    }
  }

  /**
   * Assign a player to a team with automatic balancing
   */
  private assignPlayerToTeam(player: IEntity): Team {
    let assignedTeam: Team;

    // Assign to team with fewer players (balancing)
    if (TeamManager.redTeamCount <= TeamManager.blueTeamCount) {
      assignedTeam = Team.Red;
      TeamManager.redTeamCount++;
    } else {
      assignedTeam = Team.Blue;
      TeamManager.blueTeamCount++;
    }

    // Store the assignment
    TeamManager.playerTeams.set(player, assignedTeam);

    return assignedTeam;
  }

  /**
   * Remove a player from their team
   */
  private removePlayerFromTeam(player: IEntity): void {
    const team = TeamManager.playerTeams.get(player);

    if (team === Team.Red) {
      TeamManager.redTeamCount = Math.max(0, TeamManager.redTeamCount - 1);
    } else if (team === Team.Blue) {
      TeamManager.blueTeamCount = Math.max(0, TeamManager.blueTeamCount - 1);
    }

    // Remove from registry
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
