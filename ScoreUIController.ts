// ScoreUIController.ts
import {
  Component,
  component,
  subscribe,
  OnEntityStartEvent,
  property,
  type IEntity,
  Execution,
} from "meta/platform_api@index";
import { console } from "meta/scripting_jsi@native_objects/Console";
import {
  Team,
  TeamManager,
  TeamAssignmentNetworkEvent,
  TeamAssignmentPayload,
} from "./TeamManager";

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
   * ALL CLIENTS - Listen for complete team assignment updates and update "YOU" indicator
   * Note: Simplified version that logs team assignments. In a full implementation,
   * this would detect if the local player is in the team lists.
   */
  @subscribe(TeamAssignmentNetworkEvent, {
    execution: Execution.Everywhere,
  })
  onTeamAssignmentUpdate(payload: TeamAssignmentPayload) {
    console.log(
      `👤 ScoreUIController: Received team assignment update - Red: ${payload.redTeamPlayers.length}, Blue: ${payload.blueTeamPlayers.length}`
    );

    // TODO: In a full implementation, check if the local player's debugId
    // is in either payload.redTeamPlayers or payload.blueTeamPlayers arrays
    // and call this.updateTeamIndicator(team) accordingly

    // Example of how this would work:
    // const localPlayerDebugId = getLocalPlayerDebugId(); // This API doesn't exist yet
    // if (payload.redTeamPlayers.includes(localPlayerDebugId)) {
    //   this.updateTeamIndicator(Team.Red);
    // } else if (payload.blueTeamPlayers.includes(localPlayerDebugId)) {
    //   this.updateTeamIndicator(Team.Blue);
    // }

    // For now, this demonstrates the complete team assignment logging
    // The UI framework will need proper local player detection
  }

  /**
   * Initialize the UI by setting default values
   */
  private initializeUI() {
    this.updateRedScore(0);
    this.updateBlueScore(0);

    console.log("📊 ScoreUIController: UI initialized with default scores");

    // TODO: Add local player team detection when proper API is available
    // This would check existing team assignments and show "YOU" indicator
  }

  /**
   * Public method to manually set team indicator (for testing or external control)
   * @param team - The team to show the "YOU" indicator for
   */
  public setPlayerTeam(team: Team) {
    console.log(
      `👤 ScoreUIController: Manually setting player team to ${team}`
    );
    this.updateTeamIndicator(team);
  }

  /**
   * Update the "YOU" indicator to show which team the player is on
   */
  private updateTeamIndicator(team: Team) {
    // For now, log what the UI would show
    // In a future update, this would find the XAML elements and update their Visibility

    if (team === Team.Red) {
      console.log("🔴 ScoreUIController: Showing 'YOU' under Red Team");
      // Future implementation:
      // const redYouElement = this.findUIElement("RedTeamYouText");
      // const blueYouElement = this.findUIElement("BlueTeamYouText");
      // if (redYouElement) redYouElement.Visibility = "Visible";
      // if (blueYouElement) blueYouElement.Visibility = "Collapsed";
    } else if (team === Team.Blue) {
      console.log("🔵 ScoreUIController: Showing 'YOU' under Blue Team");
      // Future implementation:
      // const redYouElement = this.findUIElement("RedTeamYouText");
      // const blueYouElement = this.findUIElement("BlueTeamYouText");
      // if (redYouElement) redYouElement.Visibility = "Collapsed";
      // if (blueYouElement) blueYouElement.Visibility = "Visible";
    }
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

  // Note: findUIElement method will be implemented when XAML binding is available
  // private findUIElement(elementName: string): any { ... }
}
