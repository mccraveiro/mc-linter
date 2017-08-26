const getLineMapFromPatchString = (patchString) => {
  let diffLineIndex = -1
  let fileLineIndex

  return patchString
    .split('\n')
    .reduce((lineMap, line) => {
      diffLineIndex++

      if (line.match(/^@@.*/)) {
        fileLineIndex = Number(line.match(/\+([0-9]+)/)[1]) - 1
      } else if (line[0] !== '-') {
        fileLineIndex++

        if (line[0] === '+') {
          lineMap[fileLineIndex] = diffLineIndex
        }
      }

      return lineMap
    }, {})
}

module.exports = getLineMapFromPatchString
