/* eslint-disable */
const semver = require('semver')
const cp = require('child_process')
const { basename, join } = require('path')

const { read: readConfig } = require('@changesets/config')
const readChangesets = require('@changesets/read').default
const assembleReleasePlan = require('@changesets/assemble-release-plan').default
const applyReleasePlan = require('@changesets/apply-release-plan').default
const { getPackages } = require('@manypkg/get-packages')
const {
  promises: { unlink },
} = require('fs')

function getNewVersion(version, type) {
  const gitHash = cp
    .spawnSync('git', ['rev-parse', '--short', 'HEAD'])
    .stdout.toString()
    .trim()

  return semver.inc(version, `pre${type}`, true, 'canary-' + gitHash)
}

function getRelevantChangesets(baseBranch) {
  const comparePoint = cp
    .spawnSync('git', ['merge-base', `origin/${baseBranch}`, 'HEAD'])
    .stdout.toString()
    .trim()
  const listModifiedFiles = cp
    .spawnSync('git', ['diff', '--name-only', comparePoint])
    .stdout.toString()
    .trim()
    .split('\n')

  const items = listModifiedFiles
    .filter((f) => f.startsWith('.changeset'))
    .map((f) => basename(f, '.md'))

  return items
}

async function updateVersions() {
  const cwd = process.cwd()
  // Exit pre mode
  // await unlink(join(cwd, '.changeset/pre.json'))
  const packages = await getPackages(cwd)
  const config = await readConfig(cwd, packages)
  const modifiedChangesets = getRelevantChangesets(config.baseBranch)
  const changesets = (await readChangesets(cwd)).filter((change) =>
    modifiedChangesets.includes(change.id),
  )

  if (changesets.length === 0) {
    console.warn(
      `Unable to find any relevant package for canary publishing. Please make sure changesets exists!`,
    )
    process.exit(1)
  } else {
    const releasePlan = assembleReleasePlan(
      changesets,
      packages,
      config,
      [],
      false,
    )

    if (releasePlan.releases.length === 0) {
      console.warn(
        `Unable to find any relevant package for canary releasing. Please make sure changesets exists!`,
      )
      process.exit(1)
    } else {
      for (const release of releasePlan.releases) {
        if (release.type !== 'none') {
          release.newVersion = getNewVersion(release.oldVersion, release.type)
        }
      }

      await applyReleasePlan(
        releasePlan,
        packages,
        {
          ...config,
          commit: false,
        },
        false,
        true,
      )
    }
  }
}

updateVersions()
  .then(() => {
    console.info(`Done!`)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
