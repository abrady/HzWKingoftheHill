// ControlPoint.ts
import {
  Component,
  component,
  subscribe,
  EventService,
  LocalEvent,
  NetworkEvent,
  serializable,
  type IEntity,
  Color,
  OnEntityStartEvent,
  OnPlayerCreateEvent,
  OnPlayerCreateEventPayload,
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
import { Team, TeamManager } from "./TeamManager";

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

/**
 * Event payload for control point state changes
 */
@serializable()
export class ControlPointStateChangedPayload {
  public readonly controlPointEntity: IEntity | null = null;
  public readonly newState: ControlPointState = ControlPointState.Neutral;
  public readonly redPlayersCount: number = 0;
  public readonly bluePlayersCount: number = 0;
}

/**
 * NETWORK EVENT - Broadcasts control point state changes to all clients
 * NOTE: Requires NetworkedEntityComponent on the entity using this event
 */
export const ControlPointStateChangedNetworkEvent = new NetworkEvent(
  "ControlPointStateChangedNetwork",
  ControlPointStateChangedPayload
);

@component()
export class ControlPoint extends Component {
  private redPlayersInTrigger: Set<IEntity> = new Set();
  private bluePlayersInTrigger: Set<IEntity> = new Set();
  private currentState: ControlPointState = ControlPointState.Neutral;

  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log(
      "🎮 ControlPoint: Initializing control point with networked team system"
    );
    console.log(`🔍 ControlPoint: Entity is owned: ${this.entity.isOwned()}`);
    console.log(`🔍 ControlPoint: Entity debugId: ${this.entity.debugId}`);
    this.updateControlPointColor();
    this.updateUIScores();
  }

  /**
   * AUTHORITY ONLY - Send current control point state to newly joined players
   * This ensures late-joining players see the correct control point states
   */
  @subscribe(OnPlayerCreateEvent, { execution: Execution.Owner })
  onPlayerJoined(event: OnPlayerCreateEventPayload) {
    if (!event.entity) {
      console.log("❌ ControlPoint: Player joined but no entity provided");
      return;
    }

    // Double-check we're the authority
    if (!this.entity.isOwned()) {
      console.log("⚠️ ControlPoint: Not authority, ignoring player join");
      return;
    }

    const player = event.entity;
    console.log(
      `👋 ControlPoint [AUTHORITY]: New player joined - ${player.debugId}, sending current state`
    );

    // If control point is not in neutral state, send current state to new player
    if (this.currentState !== ControlPointState.Neutral) {
      console.log(
        `📡 ControlPoint [AUTHORITY]: Sending current state (${this.currentState}) to new player ${player.debugId}`
      );

      // Send current state to all clients (filtered by controlPointEntity in receiver)
      this.entity.sendEventToEveryone(ControlPointStateChangedNetworkEvent, {
        controlPointEntity: this.entity,
        newState: this.currentState,
        redPlayersCount: this.redPlayersInTrigger.size,
        bluePlayersCount: this.bluePlayersInTrigger.size,
      });

      console.log(
        `✅ ControlPoint [AUTHORITY]: Sent state sync to new player ${player.debugId}`
      );
    } else {
      console.log(
        `ℹ️ ControlPoint [AUTHORITY]: Control point is neutral, no state sync needed for ${player.debugId}`
      );
    }
  }

  /**
   * AUTHORITY ONLY - Handle player entering trigger
   * Only the owner/server makes control point state decisions
   */
  @subscribe(OnTriggerEnterEvent, { execution: Execution.Owner })
  onTriggerEnter(event: OnTriggerEnterPayload) {
    if (!this.entity.isOwned()) {
      console.log("⚠️ ControlPoint: Not authority, ignoring trigger enter");
      return;
    }

    console.log("🎯 ControlPoint [AUTHORITY]: Trigger entered!", event);

    // Check if a player entity entered the trigger
    if (event.actorEntity) {
      console.log(
        "✅ ControlPoint [AUTHORITY]: Actor entity found:",
        event.actorEntity
      );

      const player = event.actorEntity.getComponent(PlayerComponent);
      if (player) {
        console.log("👤 ControlPoint [AUTHORITY]: Player component found!");

        // Get player team assignment from TeamManager (networked system)
        const team = TeamManager.getPlayerTeam(event.actorEntity);

        if (!team) {
          console.log(
            `❌ ControlPoint [AUTHORITY]: Player ${event.actorEntity.debugId} has no team assignment yet`
          );
          return;
        }

        console.log(
          `🎭 ControlPoint [AUTHORITY]: Player ${event.actorEntity.debugId} from ${team} team entered`
        );

        // SERVER adds player to appropriate team set
        if (team === Team.Red) {
          this.redPlayersInTrigger.add(event.actorEntity);
        } else if (team === Team.Blue) {
          this.bluePlayersInTrigger.add(event.actorEntity);
        }

        // SERVER calculates new control point state
        this.updateControlPointStateAuthority();

        // Notify GameManager locally (for any server-side logic)
        EventService.sendLocally(PlayerTouchedControlPointEvent, {
          playerEntity: event.actorEntity,
          controlPointEntity: this.entity,
        });

        console.log(
          "📤 ControlPoint [AUTHORITY]: PlayerTouchedControlPoint event sent"
        );
      } else {
        console.log(
          "❌ ControlPoint [AUTHORITY]: No player component found on actor"
        );
      }
    } else {
      console.log(
        "❌ ControlPoint [AUTHORITY]: No actor entity in trigger event"
      );
    }
  }

  /**
   * AUTHORITY ONLY - Handle player exiting trigger
   * Only the owner/server makes control point state decisions
   */
  @subscribe(OnTriggerExitEvent, { execution: Execution.Owner })
  onTriggerExit(event: OnTriggerExitPayload) {
    if (!this.entity.isOwned()) {
      console.log("⚠️ ControlPoint: Not authority, ignoring trigger exit");
      return;
    }

    console.log("🚪 ControlPoint [AUTHORITY]: Trigger exited!", event);

    if (event.actorEntity) {
      const player = event.actorEntity.getComponent(PlayerComponent);
      if (player) {
        console.log("👤 ControlPoint [AUTHORITY]: Player exiting trigger");

        // SERVER removes player from both team sets
        this.redPlayersInTrigger.delete(event.actorEntity);
        this.bluePlayersInTrigger.delete(event.actorEntity);

        // SERVER calculates new control point state
        this.updateControlPointStateAuthority();

        console.log(
          `📊 ControlPoint [AUTHORITY]: Updated state to ${this.currentState}`
        );
      }
    }
  }

  /**
   * AUTHORITY ONLY - Calculate and broadcast control point state changes
   * Only the server makes state decisions and broadcasts them to all clients
   */
  private updateControlPointStateAuthority() {
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
      newControlPointState = ControlPointState.Neutral;
    }

    // Only broadcast if state actually changed
    if (newControlPointState === this.currentState) {
      return;
    }

    this.currentState = newControlPointState;

    console.log(
      `📊 ControlPoint [AUTHORITY]: State updated to ${this.currentState} (Red: ${this.redPlayersInTrigger.size}, Blue: ${this.bluePlayersInTrigger.size})`
    );

    // BROADCAST state change to ALL clients (including self)
    this.entity.sendEventToEveryone(ControlPointStateChangedNetworkEvent, {
      controlPointEntity: this.entity,
      newState: this.currentState,
      redPlayersCount: this.redPlayersInTrigger.size,
      bluePlayersCount: this.bluePlayersInTrigger.size,
    });

    console.log(
      `🌐 ControlPoint [AUTHORITY]: Broadcasted state change to all clients`
    );
  }

  /**
   * ALL CLIENTS - Receive control point state changes from authority
   * This runs on ALL clients when control point state changes
   */
  @subscribe(ControlPointStateChangedNetworkEvent, {
    execution: Execution.Everywhere,
  })
  onControlPointStateChanged(payload: ControlPointStateChangedPayload) {
    // Only process if this is the correct control point
    if (payload.controlPointEntity !== this.entity) {
      return;
    }

    console.log(
      `🌐 ControlPoint [ALL CLIENTS]: Received state change to ${payload.newState} (Red: ${payload.redPlayersCount}, Blue: ${payload.bluePlayersCount})`
    );

    // Update local state on ALL clients
    this.currentState = payload.newState;

    // Update visual representation
    this.updateControlPointColor();

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
