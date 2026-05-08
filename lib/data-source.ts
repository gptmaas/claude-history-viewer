import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  DashboardStats,
  ProjectStats,
  Machine,
} from './types'

export interface DataSource {
  loadSessionsList(userId: string, page: number, pageSize: number, project?: string, machineId?: string, sourceType?: string): Promise<SessionsResponse>
  loadSessionDetail(userId: string, sessionId: string): Promise<SessionDetail | null>
  searchSessions(userId: string, keyword: string, filters?: { project?: string; machineId?: string }): Promise<SearchResponse>
  getDashboardStats(userId: string): Promise<DashboardStats>
  getProjects(userId: string, machineId?: string, sourceType?: string): Promise<ProjectStats[]>
  getMachines(userId: string): Promise<Machine[]>
  getAnalyticsStats(userId: string, dateRange?: { start: Date; end: Date }): Promise<import('./types').AnalyticsStats>
}

import { LocalDataSource } from './local-data-source'

let dataSourceInstance: DataSource | null = null

export function getDataSource(): DataSource {
  if (!dataSourceInstance) {
    const mode = process.env.DATA_SOURCE_MODE || 'local'
    if (mode === 'cloud') {
      // Cloud data source is initialized separately when DATABASE_URL is set
      // Dynamic import to avoid bundling db dependencies in local mode
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./db-data-source') as { DbDataSource: new () => DataSource }
        dataSourceInstance = new mod.DbDataSource()
      } catch {
        console.warn('DbDataSource not available, falling back to LocalDataSource')
        dataSourceInstance = new LocalDataSource()
      }
    } else {
      dataSourceInstance = new LocalDataSource()
    }
  }
  return dataSourceInstance
}
