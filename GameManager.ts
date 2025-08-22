import {component, Component, OnEntityStartEvent, subscribe, OnWorldUpdateEvent, OnWorldUpdateEventPayload} from 'meta/platform_api@index';

@component()
export class GameManager extends Component {
  // Called upon the creation of the Component and before OnUpdateEvent
  @subscribe(OnEntityStartEvent)
  onStart() {
    console.log('onStart');
  }

  // Called once per frame
  @subscribe(OnWorldUpdateEvent)
  onUpdate(params: OnWorldUpdateEventPayload) {
  }
}
