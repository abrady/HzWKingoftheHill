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

enum Team {
  Red = "red",
  Blue = "blue",
}

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

  @subscribe(OnEntityStartEvent)
  onStart() {
    // console.log("🎮 ControlPoint: Initializing control point");
    this.updateControlPointColor();
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

        // Determine player team (simple approach: use entity ID for demo)
        const team = this.getPlayerTeam(event.actorEntity);
        // console.log(`🎭 ControlPoint: Player assigned to team: ${team}`);

        // Add player to appropriate team set
        if (team === Team.Red) {
          this.redPlayersInTrigger.add(event.actorEntity);
        } else {
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

  private getPlayerTeam(playerEntity: IEntity): Team {
    // Simple team assignment based on debug ID hash (even = red, odd = blue)
    // In a real game, this would come from a team management system
    const debugId = playerEntity.debugId;

    // Simple hash function to convert debugId string to number
    let hash = 0;
    for (let i = 0; i < debugId.length; i++) {
      hash = ((hash << 5) - hash + debugId.charCodeAt(i)) & 0xffffffff;
    }

    const team = Math.abs(hash) % 2 === 0 ? Team.Red : Team.Blue;
    return team;
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
