import React, { Component } from 'react'
import PropTypes from 'prop-types'
import counter from './stateStream'

class Counter extends Component {
  incrementIfOdd = () => {
    if (this.props.value % 2 !== 0) {
      counter.increment()
    }
  }

  render() {
    const { value } = this.props
    return (
      <p>
        Clicked: {value} times
        {' '}
        <button onClick={counter.increment}>
          +
        </button>
        {' '}
        <button onClick={counter.decrement}>
          -
        </button>
        {' '}
        <button onClick={this.incrementIfOdd}>
          Increment if odd
        </button>
        {' '}
        <button onClick={counter.incrementAsync}>
          Increment async
        </button>
      </p>
    )
  }
}

Counter.propTypes = {
  value: PropTypes.number.isRequired,
}

export default counter.connect(
  (state => ({ value: state })),
)(Counter)
