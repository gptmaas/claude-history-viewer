import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  SearchFilters,
  DashboardStats,
  ProjectStats,
  Machine,
} from './types'

export interface DataSource {
  loadSessionsList(userId: string, page: number, pageSize: number, project?: string, machineId?: string, sourceType?: string): Promise<SessionsResponse>
  loadSessionDetail(userId: string, sessionId: string): Promise<SessionDetail | null>
  searchSessions(userId: string, filters: SearchFilters): Promise<SearchResponse>
  getDashboardStats(userId: string): Promise<DashboardStats>
  getProjects(userId: string, machineId?: string, sourceType?: string): Promise<ProjectStats[]>
  getMachines(userId: string): Promise<Machine[]>
  getAnalyticsStats(userId: string, dateRange?: { start: Date; end: Date }): Promise<import('./types').AnalyticsStats>
  getUsageAnalysis(userId: string, dateRange?: { start: Date; end: Date }): Promise<import('./types').UsageAnalysisData>
}

import { LocalDataSource } from './local-data-source'

let dataSourceInstance: DataSource | null = null

export function getDataSource(): DataSource {
  if (!dataSourceInstance) {
    const mode = process.env.DATA_SOURCE_MODE || 'local'
    if (mode === 'cloud') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./db-data-source') as { DbDataSource: new () => DataSource }
        dataSourceInstance = new mod.DbDataSource()
      } catch {
        console.warn('DbDataSource not available, falling back to LocalDataSource')
        dataSourceInstance = new LocalDataSource()
      }
    } else if (mode === 'local-desktop') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./local-db-data-source') as { SqliteDataSource: new () => DataSource }
        dataSourceInstance = new mod.SqliteDataSource()
      } catch {
        console.warn('SqliteDataSource not available, falling back to LocalDataSource')
        dataSourceInstance = new LocalDataSource()
      }
    } else {
      dataSourceInstance = new LocalDataSource()
    }
  }
  return dataSourceInstance
}

export function resetDataSource(): void {
  dataSourceInstance = null
}
