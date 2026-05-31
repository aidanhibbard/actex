import {
  dispatchService,
  listenService,
  mountPluginService,
} from '../services/event-bus'
import { registerEventBusTarget } from '../services/event-bus/target-access'

export class EventBus {
  private readonly target: EventTarget

  private constructor() {
    this.target = new EventTarget()
    registerEventBusTarget(this, this.target)
  }

  public static create(): EventBus {
    return new EventBus()
  }

  public readonly listen = listenService

  public readonly dispatch = dispatchService

  public readonly mount = mountPluginService
}
