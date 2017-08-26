const { assoc } = require('ramda')

const getLineMapFromPatchString = (patchString) => {
  let fileLineIndex

  return patchString
    .split('\n')
    .reduce((lineMap, line, diffLineIndex) => {
      if (line.match(/^@@.*/)) {
        fileLineIndex = Number(line.match(/\+([0-9]+)/)[1]) - 1
      } else if (line[0] !== '-') {
        fileLineIndex += 1

        if (line[0] === '+') {
          return assoc(fileLineIndex, diffLineIndex, lineMap)
        }
      }

      return lineMap
    }, {})
}

module.exports = getLineMapFromPatchString
