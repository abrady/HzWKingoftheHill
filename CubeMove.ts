import {
  component,
  Component,
  OnEntityStartEvent,
  subscribe,
  OnWorldUpdateEvent,
  OnWorldUpdateEventPayload,
  type Maybe,
  TransformComponent,
  Vec3,
  property,
  Color,
} from "meta/platform_api@index";
import { ColorComponent } from "meta/renderer";

@component()
export class CubeMove extends Component {
  private transform: Maybe<TransformComponent> = null;
  private targetPositions: Vec3[] = [
    new Vec3(10, 0.5, 10),
    new Vec3(-10, 0.5, 10),
    new Vec3(-10, 0.5, -10),
    new Vec3(10, 0.5, -10),
  ];
  private currentTargetIndex: number = 0;

  @property()
  private speed: number = 5;

  @subscribe(OnEntityStartEvent)
  onStart() {
    this.transform = this.entity.getComponent(TransformComponent);
  }

  @subscribe(OnWorldUpdateEvent)
  onUpdate(params: OnWorldUpdateEventPayload) {
    // this.transform uses the Maybe<> type, so check for null before accessing it
    if (!this.transform) {
      return;
    }

    // Calculate direction and distance to move
    const currentPosition = this.transform.worldPosition;
    const targetPosition = this.targetPositions[this.currentTargetIndex];
    const direction = targetPosition.sub(currentPosition).normalize();
    const distanceFromTarget = targetPosition.distance(currentPosition);
    const moveDistance = Math.min(
      this.speed * params.deltaTime,
      distanceFromTarget
    );

    // Apply movement
    this.transform.worldPosition = currentPosition.add(
      direction.mul(moveDistance)
    );
    // Update currentTargetIndex when we reach the target
    if (this.transform.worldPosition.equalsApprox(targetPosition, 0.1)) {
      const colorComponent = this.entity.getComponent(ColorComponent);
      if (colorComponent) {
        colorComponent.color = new Color(0, 255, 0);
      }
      this.currentTargetIndex++;
      if (this.currentTargetIndex >= this.targetPositions.length) {
        this.currentTargetIndex = 0; // loop back to the first target
      }
    }
  }
}
