#!/usr/bin/env node
/* eslint-disable no-console */

const Confirm = require('prompt-confirm')
const { CLIEngine } = require('eslint')
const GitHubApi = require('github')
const Promise = require('bluebird')
const {
  assoc,
  keys,
  path,
  pick,
  propOr,
  reduce,
  toPairs,
  unnest,
} = require('ramda')

const USERNAME = process.argv[2]
const TOKEN = process.argv[3]
const PR = process.argv[4]
const OWNER = PR.match(/^([^/]+)\//)[1]
const REPO = PR.match(/\/([^#]+)/)[1]
const PR_NUMBER = PR.match(/#(\d+)/)[1]

const github = new GitHubApi({
  Promise,
  headers: {
    'user-agent': 'mc-linter',
  },
})

github.authenticate({
  type: 'basic',
  username: USERNAME,
  password: TOKEN,
})

const linter = new CLIEngine()

const getLineMapFromPatchString = (patchString) => {
  let diffLineIndex = 0
  let fileLineIndex = 0

  return patchString
    .split('\n')
    .reduce((lineMap, line) => {
      if (line.match(/^@@.*/)) {
        fileLineIndex = line.match(/\+[0-9]+/)[0].slice(1) - 1
      } else {
        diffLineIndex++
        if (line[0] !== '-') {
          fileLineIndex++
          if (line[0] === '+') {
            lineMap[fileLineIndex] = diffLineIndex
          }
        }
      }
      return lineMap
    }, {})
}

console.log(`Fetching PR #${PR_NUMBER}`)

const groupMessages = (result, message) => {
  let newMessage = propOr('', message.line, result)
  newMessage += message.message + '\n'
  return assoc(message.line, newMessage, result)
}

github.pullRequests.getFiles({
  owner: OWNER,
  repo: REPO,
  number: PR_NUMBER,
  per_page: 100,
})
.then(response => response.data)
.filter(file => file.filename.match(/\.js$/))
.map((file) => {
  const linesChanged = getLineMapFromPatchString(file.patch)

  return github.repos.getContent({
    owner: OWNER,
    repo: REPO,
    ref: file.blob_url.match(/blob\/([a-zA-Z0-9]+)\//)[1],
    path: file.filename,
  })
  .then(response => Buffer.from(response.data.content, 'base64').toString())
  .then(linter.executeOnText.bind(linter))
  .then(path(['results', 0, 'messages']))
  .then(reduce(groupMessages, {}))
  .then(pick(keys(linesChanged)))
  .then(toPairs)
  .map(([line, message]) => ({
    path: file.filename,
    position: Number(linesChanged[line]),
    body: message,
  }))
})
.then(unnest)
.tap(console.log)
.then(comments =>
  new Confirm('Send comments?')
  .run()
  .then((answer) => {
    if (!answer) return

    return github.pullRequests.createReview({
      owner: OWNER,
      repo: REPO,
      number: PR_NUMBER,
      body: 'MC-linter',
      event: 'COMMENT',
      comments,
    })
    .tap(() => console.log('Comments sent!'))
  })
)
.catch(console.log)
