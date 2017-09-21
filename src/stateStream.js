// @flow
import Rx from 'rxjs'
import { createChangeEmitter } from 'change-emitter'
import createConnect from './createConnect'

export const SOURCE = 'SOURCE'
export const RELAY = 'RELAY'

type StreamType = 'SOURCE' | 'RELAY'
export interface StateStream {
  name: string,
  state$: Rx.Observable,
  type: StreamType,
  connect: Function,
  observe: Function,
}

type SourceStateStream = StateStream & { type: 'SOURCE', createEvent: Function }
type RelayStateStream = StateStream & { type: 'RELAY' }

const stateObserver = state$ => observer => {
  if (typeof observer !== 'function') {
    throw new Error('Expected observer to be a function.')
  }

  const stream$ = observer(state$)

  if (!(stream$ instanceof Rx.Observable)) {
    throw new Error('Expected observer return an Observable instance.')
  }

  stream$.subscribe()
}

const createSource = (
  name: string,
  initialState?: any,
): SourceStateStream => {
  const eventEmitter = createChangeEmitter()
  let observers = []

  const stateSource$ = Rx.Observable.create(() => {})

  const stateSubject = new Rx.BehaviorSubject(initialState)
  const currentState$ = stateSource$.multicast(stateSubject).refCount()

  const event$ = Rx.Observable
    .create((observer) => {
      eventEmitter.listen(value => observer.next(value))
    })
    .mergeMap((event) => {
      const currentObserver = observers.find(observer => observer === event.type)
      const currentEvent$ = Rx.Observable.of({
        state: stateSubject.getValue(),
      })

      if (currentObserver) {
        return currentObserver(currentEvent$, ...event.params).map(state => ({
          state,
          subject: currentObserver.subject,
        }))
      }

      return Rx.Observable.empty()
    })

  event$.subscribe(event => {
    if (!event) { return }

    const { state: updater, subject } = event

    if (updater === undefined) { return }

    let nextState = updater

    if (typeof updater === 'function') {
      nextState = updater(stateSubject.getValue())
    }

    stateSubject.next(nextState)

    if (subject) {
      subject.next({ state: nextState })
    }
  })

  const createEvent = fn => {
    if (typeof fn !== 'function') {
      throw new Error('Expected param of createEvent to be a function.')
    }

    const subject = new Rx.Subject()

    fn.subject = subject

    observers = [...observers, fn]

    return (...params) => {

      eventEmitter.emit({
        type: fn,
        params,
      })

      return subject.first()
    }
  }

  return {
    name,
    createEvent,
    state$: currentState$,
    type: SOURCE,
    connect: createConnect(currentState$),
    observe: stateObserver(currentState$),
  }
}

const createRelay = (
  name: string,
  sources: Array<StateStream>,
): RelayStateStream => {
  if (sources.length === 0) {
    throw new Error('Expected the sources to be passed.')
  }

  const sourceNames = {}
  sources.forEach((source) => {
    if (typeof source !== 'object' || !source.name || !source.state$ || !source.type) {
      throw new Error('Expected the source to be type of StateStream.')
    }

    sourceNames[source.name] = 1
  })

  if (Object.keys(sourceNames).length !== sources.length) {
    throw new Error('Sources\' name should be unique.')
  }

  const states$ = sources.map(source => source.state$)
  const state$ = Rx.Observable.combineLatest(...states$, (...states) => {
    let state = {}

    sources.forEach((source, index) => {
      state[source.name] = states[index]
    })

    return state
  })

  return {
    name,
    state$,
    type: RELAY,
    connect: createConnect(state$),
    observe: stateObserver(state$),
  }
}

export const createStateStream = (
  name: string,
  type: StreamType,
  initialState: any,
  sources?: Array<StateStream>,
) => {
  if (typeof name !== 'string' || !name) {
    throw new Error('Expected the name to be a not none string.')
  }

  if (!type
    || typeof type !== 'string'
    || ![SOURCE, RELAY].find(streamType => streamType === type)
  ) {
    throw new Error('Expected the type to be one of [SOURCE, RELAY].')
  }

  let streamType = type.toUpperCase()

  if (streamType === SOURCE) {
    return createSource(name, initialState)
  } else if (streamType === RELAY) {
    return createRelay(name, sources || [])
  }

  return null
}

export const createSourceStateStream = (
  name: string,
  initialState?: any,
) => createStateStream(name, SOURCE, initialState, [])

export const createRelayStateStream = (
  name: string,
  sources: Array<StateStream>,
) => createStateStream(name, RELAY, null, sources)
