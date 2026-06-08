import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo',
  'coverage', '.cache', '.claude', '__pycache__', '.DS_Store',
])

const MAX_DEPTH = 3
const MAX_OUTPUT_CHARS = 16000

export function scanProject(projectDir: string): string {
  const sections: string[] = []

  sections.push('## 文件树\n```\n' + buildFileTree(projectDir, '', 0) + '```')

  const pkgPath = join(projectDir, 'package.json')
  if (existsSync(pkgPath)) {
    sections.push(summarizePackageJson(pkgPath))
  }

  const apiDir = join(projectDir, 'app', 'api')
  if (existsSync(apiDir)) {
    sections.push('## API 路由\n```\n' + buildFileTree(apiDir, 'app/api/', 0) + '```')
  }

  const schemaDir = join(projectDir, 'lib', 'db')
  if (existsSync(schemaDir)) {
    sections.push('## 数据模型\n```\n' + buildFileTree(schemaDir, 'lib/db/', 0) + '```')
  }

  const compDir = join(projectDir, 'components')
  if (existsSync(compDir)) {
    sections.push('## 组件\n```\n' + buildFileTree(compDir, 'components/', 0) + '```')
  }

  const configs = ['tsconfig.json', 'next.config.js', 'next.config.mjs', 'next.config.ts']
  for (const cfg of configs) {
    const p = join(projectDir, cfg)
    if (existsSync(p)) {
      const content = truncateFile(p)
      if (content) sections.push(`## ${cfg}\n\`\`\`\n${content}\n\`\`\``)
    }
  }

  try {
    const diffStat = execSync('git diff --stat HEAD~10..HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 5000,
    }).trim()
    if (diffStat) {
      sections.push('## 近期变更 (git diff --stat)\n```\n' + diffStat + '\n```')
    }
  } catch {
    // Not a git repo or no commits
  }

  const result = sections.join('\n\n')
  return result.length > MAX_OUTPUT_CHARS ? result.slice(0, MAX_OUTPUT_CHARS) + '\n\n... (已截断)' : result
}

function buildFileTree(dir: string, prefix: string, depth: number): string {
  if (depth >= MAX_DEPTH) return prefix + '...\n'

  let entries: Array<{ name: string; isDir: boolean }>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => !IGNORE_DIRS.has(e.name) && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, isDir: e.isDirectory() }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return ''
  }

  let result = ''
  for (const entry of entries.slice(0, 30)) {
    result += prefix + entry.name + (entry.isDir ? '/' : '') + '\n'
    if (entry.isDir) {
      result += buildFileTree(join(dir, entry.name), prefix + '  ', depth + 1)
    }
  }
  if (entries.length > 30) {
    result += prefix + `... and ${entries.length - 30} more\n`
  }
  return result
}

function summarizePackageJson(pkgPath: string): string {
  try {
    const raw = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    const lines: string[] = ['## package.json']
    if (pkg.name) lines.push(`- name: ${pkg.name}`)
    if (pkg.version) lines.push(`- version: ${pkg.version}`)
    if (pkg.dependencies) {
      const deps = Object.keys(pkg.dependencies)
      lines.push(`- dependencies (${deps.length}): ${deps.slice(0, 20).join(', ')}${deps.length > 20 ? ' ...' : ''}`)
    }
    if (pkg.devDependencies) {
      const deps = Object.keys(pkg.devDependencies)
      lines.push(`- devDependencies (${deps.length}): ${deps.slice(0, 15).join(', ')}`)
    }
    if (pkg.scripts) {
      const scripts = Object.entries(pkg.scripts).map(([k, v]) => `${k}: ${v}`)
      lines.push(`- scripts: ${scripts.join(', ')}`)
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}

function truncateFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    return lines.length > 500
      ? lines.slice(0, 500).join('\n') + '\n... (truncated)'
      : content
  } catch {
    return ''
  }
}
