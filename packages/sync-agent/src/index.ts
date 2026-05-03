import { Command } from 'commander'
import pc from 'picocolors'
import ora from 'ora'
import { loadConfig, saveConfig, getDefaultClaudeDir, getOrCreateMachineId } from './config'
import { fullSync, getSyncStatus } from './sync'
import { startWatcher } from './watcher'
import { createInterface } from 'readline'

const program = new Command()

program
  .name('codememory-sync')
  .description('CodeMemory - sync AI coding sessions to cloud')
  .version('0.2.0')

program
  .command('init')
  .description('Configure sync settings')
  .action(async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve))

    console.log(pc.cyan('\nCodeMemory Sync Configuration\n'))

    const serverUrl = await question(pc.dim('Server URL: '))
    const apiKey = await question(pc.dim('API Key: '))
    const claudeDir = await question(pc.dim(`Claude directory [${getDefaultClaudeDir()}]: `))
    const interval = await question(pc.dim('Sync interval in seconds [60]: '))

    rl.close()

    const machineId = getOrCreateMachineId()

    saveConfig({
      serverUrl: serverUrl.replace(/\/$/, ''),
      apiKey,
      claudeDir: claudeDir || getDefaultClaudeDir(),
      syncInterval: parseInt(interval) || 60,
      machineId,
    })

    console.log(pc.green('\nConfiguration saved!'))
    console.log(pc.dim(`Machine ID: ${machineId}`))
    console.log(pc.dim('Run `codememory-sync start` to begin syncing.\n'))
  })

program
  .command('start')
  .description('Start sync daemon')
  .action(async () => {
    const config = loadConfig()
    if (!config) {
      console.error(pc.red('No configuration found. Run `codememory-sync init` first.'))
      process.exit(1)
    }

    console.log(pc.cyan('\nCodeMemory Sync Daemon\n'))
    console.log(pc.dim(`Server: ${config.serverUrl}`))
    console.log(pc.dim(`Claude dir: ${config.claudeDir}`))
    console.log(pc.dim(`Machine ID: ${config.machineId}`))

    // Initial sync
    const spinner = ora('Running initial sync...').start()
    const result = await fullSync(config)

    if (result.error) {
      spinner.fail(`Initial sync had errors: ${result.error}`)
    } else {
      spinner.succeed(`Initial sync complete: ${result.syncedFiles} files synced, ${result.skippedFiles} unchanged (${result.totalFiles} total)`)
    }

    // Start watching
    startWatcher(config)

    process.on('SIGINT', () => {
      console.log(pc.yellow('\nShutting down...'))
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      console.log(pc.yellow('\nShutting down...'))
      process.exit(0)
    })
  })

program
  .command('sync')
  .description('Run a one-time sync')
  .action(async () => {
    const config = loadConfig()
    if (!config) {
      console.error(pc.red('No configuration found. Run `codememory-sync init` first.'))
      process.exit(1)
    }

    const spinner = ora('Syncing...').start()
    const result = await fullSync(config)

    if (result.error) {
      spinner.fail(`Sync had errors: ${result.error}`)
    } else {
      spinner.succeed(`Synced ${result.syncedFiles} files, ${result.skippedFiles} unchanged (${result.totalFiles} total)`)
    }
  })

program
  .command('status')
  .description('Show sync status')
  .action(async () => {
    const config = loadConfig()
    if (!config) {
      console.error(pc.red('No configuration found. Run `codememory-sync init` first.'))
      process.exit(1)
    }

    const spinner = ora('Checking status...').start()
    const status = await getSyncStatus(config)

    if (status.error) {
      spinner.fail(`Failed to get status: ${status.error}`)
      process.exit(1)
    }
    spinner.stop()

    console.log(pc.cyan('\nSync Status\n'))
    console.log(`  Last sync:  ${status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : pc.dim('Never')}`)
    console.log(`  Machine ID: ${config.machineId}`)
    console.log(`  Raw files:  ${status.totalRawFiles}`)
    console.log(`  Sessions:   ${status.totalSessions}`)
    console.log(`  Messages:   ${status.totalMessages}`)
    if (status.pendingParseCount > 0) {
      console.log(pc.yellow(`  Pending parse: ${status.pendingParseCount}`))
    }
    console.log()
  })

program.parse()
