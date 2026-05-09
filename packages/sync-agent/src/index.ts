import { Command } from 'commander'
import pc from 'picocolors'
import ora from 'ora'
import { loadConfig, saveConfig, getDefaultClaudeDir, getOrCreateMachineId, getOrCreateMachineName } from './config'
import { fullSync, getSyncStatus } from './sync'
import { startWatcher } from './watcher'
import { createInterface } from 'readline'
import { getAvailableSourceNames, getSourceLabel, getDefaultDir } from './sources'

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

    // Source selection
    const availableSources = getAvailableSourceNames()
    console.log(pc.dim('\nAvailable sources:'))
    for (const name of availableSources) {
      console.log(pc.dim(`  - ${name} (${getSourceLabel(name)})`))
    }
    const sourcesInput = await question(pc.dim(`Enable sources (comma-separated) [claude-code]: `))
    const sources = sourcesInput
      ? sourcesInput.split(',').map(s => s.trim()).filter(Boolean)
      : ['claude-code']

    // Per-source directory config
    const sourceDirs: Record<string, string> = {}
    for (const source of sources) {
      const defaultDir = getDefaultDir(source)
      const dir = await question(pc.dim(`${getSourceLabel(source)} directory [${defaultDir}]: `))
      if (dir) sourceDirs[source] = dir
    }

    const interval = await question(pc.dim('Sync interval in seconds [60]: '))

    rl.close()

    const machineId = getOrCreateMachineId()
    const machineName = getOrCreateMachineName()

    saveConfig({
      serverUrl: serverUrl.replace(/\/$/, ''),
      apiKey,
      claudeDir: sourceDirs['claude-code'] ?? getDefaultDir('claude-code'),
      syncInterval: parseInt(interval) || 60,
      machineId,
      machineName,
      sources,
      sourceDirs: Object.keys(sourceDirs).length > 0 ? sourceDirs : undefined,
    })

    console.log(pc.green('\nConfiguration saved!'))
    console.log(pc.dim(`Machine: ${machineName} (${machineId})`))
    console.log(pc.dim(`Sources: ${sources.map(s => getSourceLabel(s)).join(', ')}`))
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

    const sourceNames = config.sources ?? ['claude-code']

    console.log(pc.cyan('\nCodeMemory Sync Daemon\n'))
    console.log(pc.dim(`Server: ${config.serverUrl}`))
    console.log(pc.dim(`Sources: ${sourceNames.map(s => getSourceLabel(s)).join(', ')}`))
    console.log(pc.dim(`Machine: ${config.machineName} (${config.machineId})`))

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
    console.log(`  Machine:    ${config.machineName} (${config.machineId})`)
    console.log(`  Sources:    ${(config.sources ?? ['claude-code']).map(s => getSourceLabel(s)).join(', ')}`)
    console.log(`  Raw files:  ${status.totalRawFiles}`)
    console.log(`  Sessions:   ${status.totalSessions}`)
    console.log(`  Messages:   ${status.totalMessages}`)
    if (status.pendingParseCount > 0) {
      console.log(pc.yellow(`  Pending parse: ${status.pendingParseCount}`))
    }
    console.log()
  })

program.parse()
