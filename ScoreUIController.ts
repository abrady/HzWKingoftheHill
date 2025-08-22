// ScoreUIController.ts
import {
  Component,
  component,
  subscribe,
  OnEntityStartEvent,
  property,
  type IEntity,
} from "meta/platform_api@index";
import { console } from "meta/scripting_jsi@native_objects/Console";

/**
 * UI Controller component that manages the score display in the XAML UI.
 * This component should be attached to an entity that can reference the UI elements.
 */
@component()
export class ScoreUIController extends Component {
  /**
   * Reference to the UI entity containing the XAML elements.
   * This should be set to point to the entity with the UI.xaml attached.
   */
  @property()
  uiEntity: IEntity | null = null;

  private redScoreValue: number = 0;
  private blueScoreValue: number = 0;

  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log("🎮 ScoreUIController: Initializing UI controller");
    this.initializeUI();
  }

  /**
   * Initialize the UI by setting default values
   */
  private initializeUI() {
    this.updateRedScore(0);
    this.updateBlueScore(0);
    console.log("📊 ScoreUIController: UI initialized with default scores");
  }

  /**
   * Update the red team's score display
   * @param score - The new score value
   */
  public updateRedScore(score: number) {
    this.redScoreValue = score;
    this.updateUIDisplay();
    console.log(`🔴 ScoreUIController: Red score updated to ${score}`);
  }

  /**
   * Update the blue team's score display
   * @param score - The new score value
   */
  public updateBlueScore(score: number) {
    this.blueScoreValue = score;
    this.updateUIDisplay();
    console.log(`🔵 ScoreUIController: Blue score updated to ${score}`);
  }

  /**
   * Update both team scores at once
   * @param redScore - Red team score
   * @param blueScore - Blue team score
   */
  public updateScores(redScore: number, blueScore: number) {
    this.redScoreValue = redScore;
    this.blueScoreValue = blueScore;
    this.updateUIDisplay();
    console.log(
      `📊 ScoreUIController: Scores updated - Red: ${redScore}, Blue: ${blueScore}`
    );
  }

  /**
   * Get the current red team score
   */
  public getRedScore(): number {
    return this.redScoreValue;
  }

  /**
   * Get the current blue team score
   */
  public getBlueScore(): number {
    return this.blueScoreValue;
  }

  /**
   * Update the actual UI display
   * TODO: Implement actual XAML element updates when binding is available
   */
  private updateUIDisplay() {
    // For now, this logs what the UI would show
    // In a future update, this would find the XAML elements by name and update their Text properties

    console.log(
      `🖥️ ScoreUIController: UI would display - RedScoreText: "${this.redScoreValue}", BlueScoreText: "${this.blueScoreValue}"`
    );

    // Future implementation would look something like:
    // const redScoreElement = this.findUIElement("RedScoreText");
    // const blueScoreElement = this.findUIElement("BlueScoreText");
    // if (redScoreElement) redScoreElement.Text = this.redScoreValue.toString();
    // if (blueScoreElement) blueScoreElement.Text = this.blueScoreValue.toString();
  }

  /**
   * Helper method to find UI elements by name (placeholder for future implementation)
   * @param elementName - The x:Name of the XAML element
   */
  private findUIElement(elementName: string): any {
    // Placeholder - would implement XAML element lookup here
    console.log(`🔍 ScoreUIController: Looking for UI element: ${elementName}`);
    return null;
  }
}
