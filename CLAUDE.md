# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Meta Horizon Worlds project written in TypeScript. It is a multiplayer game where try to gain points by touching control points around the level:

1. if a player from the blue team touches a control point, the blue team gains control of that control point and it turns blue. likewise for the red team.
2. if players from both teams touch a control point, the control point turns yellow and neither team gains control of it.

## Technology Stack

- **Language**: TypeScript (ES2022)
- **Platform**: Meta Horizon Worlds (Meta's VR/AR platform)
- **UI Framework**: XAML for user interfaces
- **Architecture**: Component-based Entity System using Meta's platform API

## Project Structure

- `*.ts` - TypeScript component scripts that define game behavior
- `*.ts.assetmeta` - Meta platform asset metadata files
- `UI.xaml` - XAML UI definition for team-based scoring interface
- `space.hstf` - Horizon Worlds space/scene file
- `HelloWorld.hzproject` - Main Horizon Worlds project configuration
- `materialMap.json` - Material mapping configuration
- `tsconfig.json` - TypeScript compiler configuration with extensive Meta framework paths

## Key Components

### CubeMove Component

- Handles moving cube entities in a predefined path pattern
- Uses TransformComponent for position manipulation
- Changes color via ColorComponent when reaching targets
- Located in: `CubeMove.ts:17`

### GameManager Component

- Main game logic controller (currently minimal implementation)
- Standard component lifecycle with start and update events
- Located in: `GameManager.ts:4`

### TeamManager Component

- Manages team-based functionality (currently minimal implementation)
- Standard component lifecycle structure
- Located in: `TeamManager.ts:4`

### UI System

- XAML-based scoreboard showing Red Team vs Blue Team scores
- Includes timer display and team score tracking
- Grid-based layout with responsive design
- Located in: `UI.xaml:6`

## Meta Platform API Usage

The project extensively uses Meta's platform APIs through import paths like:

- `meta/platform_api@index` - Core platform functionality providing complete HSR API
- `meta/renderer` - Rendering components (ColorComponent, etc.)
- `meta/physics` - Physics simulation components
- `meta/audio` - Audio system components
- `meta/player` - Player interaction components

## Core Platform Architecture

### Entity-Component System (ECS)

Horizon uses a pure Entity-Component System where:

- **Entities** are containers for components with unique IDs
- **Components** contain data and logic, extend from `Component` base class
- Components are attached to entities and communicate through events
- Entities can be local (single client) or networked (synchronized across clients)

### Component Lifecycle

1. **OnEntityCreateEvent**: Fired when entity components are created (instantiation)
2. **OnEntityStartEvent**: Fired after all world entities are created (initialization)
3. **OnWorldUpdateEvent**: Fired every frame with deltaTime parameter (update loop)
4. **OnEntityDestroyEvent**: Fired when entity is destroyed (cleanup)

### Component Class Structure

```typescript
@component()
export class MyComponent extends Component {
  @property()
  public myProperty: number = 0;

  @subscribe(OnEntityStartEvent)
  onStart() {
    // Initialization logic here
  }

  @subscribe(OnWorldUpdateEvent)
  onUpdate(event: OnWorldUpdateEventPayload) {
    // Frame update logic here
    const deltaTime = event.deltaTime;
  }
}
```

## Development Patterns

### 1. Component Lifecycle Management

- Never write constructor logic - use lifecycle events instead
- Use `OnEntityStartEvent` for initialization after all entities exist
- Use `OnWorldUpdateEvent` sparingly to avoid performance issues
- Clean up subscriptions in `OnEntityDestroyEvent`

### 2. Type Safety & Null Handling

- Use `Maybe<T>` types for potentially null component references
- Always check component existence: `const comp = this.entity.getComponent(MyComponent);`
- Use `getComponentOrThrow()` when component existence is guaranteed

### 3. Property System

- Use `@property()` decorator to expose values in Horizon Editor
- Properties support various types: numbers, strings, booleans, Vec3, Color, Assets
- Properties are automatically serialized and networked when needed

### 4. Entity-Component Interaction

```typescript
// Getting components from same entity
const transform = this.entity.getComponent(TransformComponent);
const renderer = this.getComponentOrThrow(SomeRendererComponent);

// Getting components from other entities requires entity reference
const otherTransform = otherEntity.getComponent(TransformComponent);
```

### 5. Asset Management

Platform supports various asset types:

- `MeshAsset` - 3D models and geometry
- `TextureAsset` - Images and textures
- `SoundAsset` - Audio files
- `MaterialAsset` - Material definitions
- `VfxAsset` - Visual effects
- `TemplateAsset` - Prefab entity templates

## Math & Utility Classes

### Vector Mathematics

- `Vec2` - 2D vector operations
- `Vec3` - 3D vector operations with full math support
- `Vec4` - 4-component vectors
- `Quaternion` - Rotation representation and operations
- `Color` - Color representation and manipulation

### Math Utilities

```typescript
import {
  clamp,
  lerp,
  unlerp,
  radiansToDegrees,
  degreesToRadians,
} from "meta/platform_api";

const clampedValue = clamp(value, 0, 100);
const interpolated = lerp(start, end, t);
const angle = radiansToDegrees(radians);
```

## Service Architecture

### Core Services

- **EntityService** - Entity creation, destruction, and management
- **EventService** - Event sending and management
- **PlayerService** - Player lifecycle and management
- **PlayerInputService** - Input handling and haptic feedback
- **WorldService** - World-level operations and updates
- **NetworkingService** - Network communication management

### Service Usage Pattern

```typescript
import { entityService, EventService } from "meta/platform_api";

// Services are singletons accessible from anywhere
const allEntities = entityService.getAllEntities();
EventService.sendLocally(myEvent, payload);
```

## Advanced Features

### Ownership System

- Entities have owners (usually server or specific client)
- Only owners can send network events to other clients
- Use `this.entity.isOwned()` to check ownership
- Ownership can transfer during gameplay

### Transform System

```typescript
const transform = this.entity.getComponent(TransformComponent);
if (transform) {
  // Local space operations
  transform.localPosition = new Vec3(1, 2, 3);
  transform.localRotation = Quaternion.fromEulerAngles(0, 90, 0);

  // World space operations
  const worldPos = transform.worldPosition;
  transform.setWorldPosition(new Vec3(5, 0, 5));
}
```

### Player Input Handling

```typescript
@subscribe(OnPlayerInputEvent)
onPlayerInput(event: OnPlayerInputEventPayload) {
  const inputs = event.inputValues;

  // Check button states
  if (inputs.primaryButton === ButtonState.Pressed) {
    // Handle primary button press
  }

  // Get controller positions
  const leftHand = inputs.leftHand;
  const rightHand = inputs.rightHand;

  // Trigger haptic feedback
  PlayerInputService.triggerHaptic(
    PlayerInputHand.Right,
    HapticStrength.Medium,
    HapticSharpness.Sharp,
    1.0 // duration
  );
}
```

### Sublevel System

- **Sublevels** allow dynamic loading/unloading of world sections
- Use `SublevelComponent` to manage sublevel states
- States: `Loading`, `Loaded`, `Unloading`, `Unloaded`
- Subscribe to `OnSublevelStateChangeEvent` for state transitions

## HSR Event System

### Event Types

- **Native Events**: Built-in platform events (OnEntityStartEvent, OnWorldUpdateEvent, OnPlayerCreatedEvent, etc.)
- **Local Events**: Custom events that stay within the local client (no network traffic)
- **Network Events**: Custom events that communicate across clients in multiplayer

### Event Architecture

- Events are messages between script components with optional payload data
- Event definitions include name, scope, and payload structure
- Event listeners handle incoming events with `@subscribe()` decorator
- Event execution order is non-deterministic between different scripts

### Native Event Lifecycle

1. **OnEntityCreateEvent**: Fired when entity components are created
2. **OnEntityStartEvent**: Fired after all world entities are created
3. **OnWorldUpdateEvent**: Fired every frame with deltaTime parameter
4. **OnEntityDestroyEvent**: Fired when entity is destroyed

### Local Events Best Practices

- Use for immediate user feedback (audio, animations, UI updates)
- Zero network latency - execute entirely on local client
- Create with `new LocalEvent('eventName', PayloadType)`
- Send with `EventService.sendLocally()` or `this.sendLocalEvent()`

### Network Events Best Practices

- Use for cross-client communication (damage, game state changes)
- Sent reliably by default but can have network latency
- Create with `new NetworkEvent('eventName', PayloadType)`
- Send with `EventService.sendToEveryone()` or `this.sendEventToOwner()`
- Payload types must use `@serializable()` decorator

### Event Execution Context

- Use `{execution: Execution.Owner}` to run only on entity owner
- Use `{execution: Execution.NonOwner}` to run only on non-owners
- Use `{execution: Execution.Everywhere}` to run on all clients
- Most entities are owned by server by default

### Performance Considerations

- Prefer local events when networking isn't required
- Avoid heavy code in OnWorldUpdateEvent (runs every frame)
- Target specific entities when sending events to reduce network traffic
- Use `EventService.sendGlobally()` sparingly as it broadcasts to all clients

## Important Patterns & Best Practices

1. **Component Lifecycle**: All components follow create → start → update → destroy pattern
2. **Null Safety**: Use Maybe<> types and null checks before accessing components
3. **Entity-Component System**: Get components via `this.entity.getComponent()`
4. **Event Subscription**: Use `@subscribe()` decorator for event handling
5. **Property Exposure**: Use `@property()` decorator for editor-configurable values
6. **Ownership Awareness**: Check entity ownership before sending network events
7. **Performance Considerations**: Minimize OnWorldUpdateEvent usage, prefer event-driven logic
8. **Serialization**: Mark event payloads with `@serializable()` for network events
9. **Type Safety**: Leverage TypeScript's type system and Maybe<> for safe component access
10. **Service Architecture**: Use singleton services for global functionality

## Networking Architecture Analysis

### 1. New Player Joins (Team Assignment)

**Current Implementation (TeamManager.ts):**

- ✅ **Authority-Based**: Only the entity owner (server) makes team assignment decisions using `{execution: Execution.Owner}`
- ✅ **Balanced Assignment**: Server assigns players to teams based on current team counts for balance
- ✅ **Network Replication**: Team assignments are broadcast to all clients using `PlayerTeamAssignedNetworkEvent`
- ✅ **State Synchronization**: All clients update their local team state when receiving network events

**Flow:**

1. Player joins → `OnPlayerCreateEvent` fires on authority/server only
2. Server calculates balanced team assignment (Red vs Blue based on current counts)
3. Server broadcasts `PlayerTeamAssignedNetworkEvent` to all clients
4. All clients receive event and update their local team maps and counts
5. Network event includes: player entity, assigned team, updated team counts

### 2. ControlPoint State Replication

**Current Issues (ControlPoint.ts):**

- ❌ **No Networking**: Control point state changes are purely local
- ❌ **Inconsistent Team Assignment**: Uses hash-based team assignment instead of TeamManager
- ❌ **Desync Risk**: Each client calculates control point state independently

**Current Flow (Problematic):**

1. Player enters trigger → Only local client sees the change
2. Local hash-based team assignment (inconsistent across clients)
3. Local control point state update (not synchronized)
4. Local color change (visual desync possible)

**Required Fix:**

- Control points should use TeamManager for team assignments
- Control point state changes should be networked
- Authority should determine control point state and broadcast to all clients

### 3. UI Updates from ControlPoint

**Current Implementation (ScoreUIController.ts):**

- ✅ **Centralized UI Management**: Single component handles all score display logic
- ❌ **No Network Integration**: UI controller doesn't receive network events
- ❌ **No ControlPoint Integration**: No communication between ControlPoint and UI

**Current Flow (Limited):**

1. ScoreUIController initializes with default scores (0,0)
2. Manual score updates through public methods
3. UI display updates (currently console logs only)

**Missing Integration:**

- ControlPoint should send events to UI when state changes
- UI should respond to networked game state changes
- Score accumulation logic needs implementation

### Network Event Patterns

**Proper Authority-Based Networking:**

```typescript
// AUTHORITY ONLY - Server makes decisions
@subscribe(OnSomeEvent, { execution: Execution.Owner })
onAuthorityEvent(event: SomeEventPayload) {
  if (!this.entity.isOwned()) return; // Double-check authority

  // Server logic here
  const decision = this.makeServerDecision();

  // Broadcast to all clients
  this.entity.sendEventToEveryone(SomeNetworkEvent, {
    decision: decision,
    timestamp: Date.now()
  });
}

// ALL CLIENTS - Receive and apply server decisions
@subscribe(SomeNetworkEvent, { execution: Execution.Everywhere })
onNetworkEvent(payload: SomeNetworkPayload) {
  // All clients update local state
  this.applyServerDecision(payload.decision);
}
```

**Network Event Requirements:**

```typescript
@serializable()
export class NetworkEventPayload {
  public readonly data: any = null; // Must be serializable
  public readonly timestamp: number = 0;
}

export const SomeNetworkEvent = new NetworkEvent(
  "SomeNetworkEventName",
  NetworkEventPayload
);
```

### Critical Networking Issues to Fix

1. **ControlPoint Networking**:

   - Replace hash-based team assignment with TeamManager integration
   - Add authority-based control point state management
   - Network control point state changes to all clients

2. **UI Integration**:

   - Connect ControlPoint events to ScoreUIController
   - Add networked score update events
   - Implement proper score accumulation logic

3. **State Consistency**:
   - Ensure all game state changes are authority-driven
   - Use network events for cross-client communication
   - Implement proper client state synchronization

## Common Code Patterns

### Creating Custom Events

```typescript
@serializable()
class MyEventPayload {
  public message: string;
  public value: number;
}

const myLocalEvent = new LocalEvent("MyLocalEvent", MyEventPayload);
const myNetworkEvent = new NetworkEvent("MyNetworkEvent", MyEventPayload);
```

### Event Handling with Proper Types

```typescript
@subscribe(myLocalEvent)
onMyEvent(payload: MyEventPayload) {
  console.log(`Received: ${payload.message} with value ${payload.value}`);
}
```

### Safe Component Access Pattern

```typescript
@subscribe(OnEntityStartEvent)
onStart() {
  const transform = this.entity.getComponent(TransformComponent);
  if (transform) {
    // Safe to use transform here
    transform.localPosition = new Vec3(0, 1, 0);
  }
}
```

### Property Change Subscriptions

```typescript
@subscribe(OnEntityStartEvent)
onStart() {
  const otherComponent = this.entity.getComponent(OtherComponent);
  if (otherComponent) {
    this.subscribePropertyChange('someProperty', () => {
      console.log('Property changed!');
    }, otherComponent);
  }
}
```
