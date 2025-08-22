// ControlPoint.ts
import {
  Component,
  component,
  subscribe,
  EventService,
  LocalEvent,
  serializable,
  type IEntity,
  Color,
  OnEntityStartEvent,
  NetworkEvent,
  Execution,
} from "meta/platform_api@index";
import { console } from "meta/scripting_jsi@native_objects/Console";
import {
  OnTriggerEnterEvent,
  OnTriggerEnterPayload,
  OnTriggerExitEvent,
  OnTriggerExitPayload,
} from "meta/physics@index";
import { PlayerComponent } from "meta/player@index";
import { ColorComponent } from "meta/renderer@index";

// Team enum definition (matches TeamManager)
enum Team {
  Red = "red",
  Blue = "blue",
}

/**
 * Team assignment event payload (matches TeamManager)
 */
@serializable()
class PlayerTeamAssignedPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly team: Team = Team.Red;
  public readonly redTeamCount: number = 0;
  public readonly blueTeamCount: number = 0;
}

/**
 * Team removal event payload (matches TeamManager)
 */
@serializable()
class PlayerTeamRemovedPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly team: Team = Team.Red;
  public readonly redTeamCount: number = 0;
  public readonly blueTeamCount: number = 0;
}

/**
 * Network events (must match TeamManager exactly)
 */
const PlayerTeamAssignedNetworkEvent = new NetworkEvent(
  "PlayerTeamAssignedNetwork",
  PlayerTeamAssignedPayload
);

const PlayerTeamRemovedNetworkEvent = new NetworkEvent(
  "PlayerTeamRemovedNetwork",
  PlayerTeamRemovedPayload
);

enum ControlPointState {
  Neutral = "neutral",
  RedControlled = "red",
  BlueControlled = "blue",
  Contested = "contested",
}

@serializable()
class PlayerTouchedControlPointPayload {
  public readonly playerEntity: IEntity | null = null;
  public readonly controlPointEntity: IEntity | null = null;
}

const PlayerTouchedControlPointEvent = new LocalEvent(
  "PlayerTouchedControlPoint",
  PlayerTouchedControlPointPayload
);

@component()
export class ControlPoint extends Component {
  private redPlayersInTrigger: Set<IEntity> = new Set();
  private bluePlayersInTrigger: Set<IEntity> = new Set();
  private currentState: ControlPointState = ControlPointState.Neutral;

  // Local registry of player team assignments (synced via network events)
  private static playerTeams: Map<IEntity, Team> = new Map();

  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log(
      "🎮 ControlPoint: Initializing control point with networked team system"
    );
    this.updateControlPointColor();
    this.updateUIScores();
  }

  /**
   * ALL CLIENTS - Listen for team assignments from TeamManager
   * This keeps our local team registry in sync
   */
  @subscribe(PlayerTeamAssignedNetworkEvent, {
    execution: Execution.Everywhere,
  })
  onPlayerTeamAssigned(payload: PlayerTeamAssignedPayload) {
    if (!payload.playerEntity) {
      console.log("❌ ControlPoint: Invalid player entity in team assignment");
      return;
    }

    console.log(
      `🌐 ControlPoint [ALL CLIENTS]: Player ${payload.playerEntity.debugId} assigned to ${payload.team} team`
    );

    // Update local player team registry
    ControlPoint.playerTeams.set(payload.playerEntity, payload.team);

    console.log(
      `📊 ControlPoint: Updated local team registry - Total players: ${ControlPoint.playerTeams.size}`
    );
  }

  /**
   * ALL CLIENTS - Listen for team removals from TeamManager
   * This keeps our local team registry in sync
   */
  @subscribe(PlayerTeamRemovedNetworkEvent, { execution: Execution.Everywhere })
  onPlayerTeamRemoved(payload: PlayerTeamRemovedPayload) {
    if (!payload.playerEntity) {
      console.log("❌ ControlPoint: Invalid player entity in team removal");
      return;
    }

    console.log(
      `🌐 ControlPoint [ALL CLIENTS]: Player ${payload.playerEntity.debugId} removed from ${payload.team} team`
    );

    // Update local player team registry
    ControlPoint.playerTeams.delete(payload.playerEntity);

    console.log(
      `📊 ControlPoint: Updated local team registry - Total players: ${ControlPoint.playerTeams.size}`
    );
  }

  @subscribe(OnTriggerEnterEvent)
  onTriggerEnter(event: OnTriggerEnterPayload) {
    // console.log("🎯 ControlPoint: Trigger entered!", event);

    // Check if a player entity entered the trigger
    if (event.actorEntity) {
      // console.log("✅ ControlPoint: Actor entity found:", event.actorEntity);

      const player = event.actorEntity.getComponent(PlayerComponent);
      if (player) {
        // console.log("👤 ControlPoint: Player component found!");

        // Get player team assignment from networked system
        const team = this.getPlayerTeam(event.actorEntity);

        // Only process players with valid team assignments
        if (team === null) {
          console.log(
            `⚠️ ControlPoint: Player ${event.actorEntity.debugId} entered trigger but has no team assignment yet - ignoring`
          );
          return;
        }

        console.log(
          `🎭 ControlPoint: Player ${event.actorEntity.debugId} from ${team} team entered`
        );

        // Add player to appropriate team set
        if (team === Team.Red) {
          this.redPlayersInTrigger.add(event.actorEntity);
        } else if (team === Team.Blue) {
          this.bluePlayersInTrigger.add(event.actorEntity);
        }

        // Update control point state and color
        this.updateControlPointState();
        this.updateControlPointColor();

        // Notify GameManager
        EventService.sendLocally(PlayerTouchedControlPointEvent, {
          playerEntity: event.actorEntity,
          controlPointEntity: this.entity,
        });

        // console.log("📤 ControlPoint: PlayerTouchedControlPoint event sent");
      } else {
        // console.log("❌ ControlPoint: No player component found on actor");
      }
    } else {
      // console.log("❌ ControlPoint: No actor entity in trigger event");
    }
  }

  @subscribe(OnTriggerExitEvent)
  onTriggerExit(event: OnTriggerExitPayload) {
    // console.log("🚪 ControlPoint: Trigger exited!", event);

    if (event.actorEntity) {
      const player = event.actorEntity.getComponent(PlayerComponent);
      if (player) {
        // console.log("👤 ControlPoint: Player exiting trigger");

        // Remove player from both team sets
        this.redPlayersInTrigger.delete(event.actorEntity);
        this.bluePlayersInTrigger.delete(event.actorEntity);

        // Update control point state and color
        this.updateControlPointState();
        this.updateControlPointColor();

        // console.log(`📊 ControlPoint: Updated state to ${this.currentState}`);
      }
    }
  }

  private getPlayerTeam(playerEntity: IEntity): Team | null {
    // Use networked team assignments from TeamManager
    const team = ControlPoint.playerTeams.get(playerEntity);

    if (team !== undefined) {
      console.log(
        `🎭 ControlPoint: Player ${playerEntity.debugId} is on ${team} team (networked)`
      );
      return team;
    } else {
      console.log(
        `❓ ControlPoint: Player ${playerEntity.debugId} has no team assignment yet - ignoring`
      );
      return null;
    }
  }

  private updateControlPointState() {
    const hasRedPlayers = this.redPlayersInTrigger.size > 0;
    const hasBluePlayers = this.bluePlayersInTrigger.size > 0;

    let newControlPointState: ControlPointState;
    if (hasRedPlayers && hasBluePlayers) {
      newControlPointState = ControlPointState.Contested;
    } else if (hasRedPlayers) {
      newControlPointState = ControlPointState.RedControlled;
    } else if (hasBluePlayers) {
      newControlPointState = ControlPointState.BlueControlled;
    } else {
      // no change. keep the current state
      return;
    }

    if (newControlPointState === this.currentState) {
      return;
    }
    this.currentState = newControlPointState;

    console.log(
      `ControlPoint: State updated to ${this.currentState} (Red: ${this.redPlayersInTrigger.size}, Blue: ${this.bluePlayersInTrigger.size})`
    );

    // Update UI scores based on new state
    this.updateUIScores();
  }

  private updateUIScores() {
    // Update scores based on control point state
    // UI integration will be added when proper module imports are supported
    switch (this.currentState) {
      case ControlPointState.RedControlled:
        console.log("📊 ControlPoint: UI would show - Red: 1, Blue: 0");
        break;
      case ControlPointState.BlueControlled:
        console.log("📊 ControlPoint: UI would show - Red: 0, Blue: 1");
        break;
      case ControlPointState.Contested:
        console.log(
          "📊 ControlPoint: UI would show - Red: 0, Blue: 0 (contested)"
        );
        break;
      case ControlPointState.Neutral:
        // Keep current scores for neutral state - don't change UI
        console.log("📊 ControlPoint: UI unchanged - neutral state");
        break;
    }
  }

  private updateControlPointColor() {
    // Look for ColorComponent on the parent entity (the visual object)
    const parentEntity = this.entity.parent;
    if (!parentEntity) {
      console.log(
        "❌ ControlPoint: No parent entity found - trigger volume should be a child of the visual object"
      );
      return;
    }

    const colorComponent = parentEntity.getComponent(ColorComponent);
    if (!colorComponent) {
      console.log("❌ ControlPoint: No ColorComponent found on parent entity");
      return;
    }

    let newColor: Color;
    switch (this.currentState) {
      case ControlPointState.RedControlled:
        newColor = new Color(1, 0, 0, 1); // Red
        console.log("🔴 ControlPoint: Setting color to RED");
        break;
      case ControlPointState.BlueControlled:
        newColor = new Color(0, 0, 1, 1); // Blue
        console.log("🔵 ControlPoint: Setting color to BLUE");
        break;
      case ControlPointState.Contested:
        newColor = new Color(1, 1, 0, 1); // Yellow
        console.log("🟡 ControlPoint: Setting color to YELLOW (contested)");
        break;
      case ControlPointState.Neutral:
      default:
        newColor = new Color(0.5, 0.5, 0.5, 1); // Gray
        console.log("⚪ ControlPoint: Setting color to GRAY (neutral)");
        break;
    }

    colorComponent.color = newColor;
    // console.log(`🎨 ControlPoint: Color updated successfully`);
  }
}
