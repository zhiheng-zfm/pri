#!/usr/bin/env node

import * as colors from "colors"
import * as commander from "commander"
import * as _ from "lodash"
import * as updateNotifier from "update-notifier"

import * as pkg from "../package.json"

import * as semver from "semver"
import { log } from "./utils/log"
import { initPlugins, plugin } from "./utils/plugins"
import text from "./utils/text"

import { pri } from "./node"

// Check node version
if (semver.lte(process.version, "8.0.0")) {
  log(`nodejs version should be greater than 8, current is ${process.version}`)
  process.exit(0)
}

async function main() {
  await initPlugins(process.cwd())

  commander.version(pkg.version, "-v, --version")

  const commandersGroupByName = _.groupBy(plugin.commands, "name")
  Object.keys(commandersGroupByName).forEach(commandName => {
    const commandDetails = commandersGroupByName[commandName]
    const actionCount = commandDetails.reduce((count, commandDetail) => count + (commandDetail.action ? 1 : 0), 0)
    if (actionCount === 0) {
      throw Error(`No command "${commandName}!"`)
    }
    if (actionCount > 1) {
      throw Error(`Can't register "${commandName}" twice!`)
    }

    const mainCommand = commandDetails.find(commandDetail => !!commandDetail.action)

    const command = commander
      .command(commandName)
      .description(mainCommand.description)
      .action(async (...args: any[]) => {
        for (const commandDetail of commandDetails) {
          if (commandDetail.beforeAction) {
            await Promise.resolve(commandDetail.beforeAction.apply(null, args))
          }
        }

        await Promise.resolve(mainCommand.action.apply(null, args))

        for (const commandDetail of commandDetails) {
          if (commandDetail.afterAction) {
            await Promise.resolve(commandDetail.afterAction.apply(null, args))
          }
        }

        // For async register commander, process will be exit automatic.
        process.exit(0)
      })

    if (mainCommand.options) {
      mainCommand.options.forEach(option => command.option(option[0], option[1]))
    }
  })

  /**
   * Parse argv.
   */
  commander.parse(process.argv)

  /**
   * When no args given, use dev command
   */
  if (!commander.args.length) {
    plugin.commands.find(command => command.isDefault === true).action()
  }

  /**
   * Update notify.
   */
  updateNotifier({ pkg }).notify()
}

main()
