import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  DashboardStats,
  ProjectStats,
} from './types'

export interface DataSource {
  loadSessionsList(userId: string, page: number, pageSize: number, project?: string): Promise<SessionsResponse>
  loadSessionDetail(userId: string, sessionId: string): Promise<SessionDetail | null>
  searchSessions(userId: string, keyword: string): Promise<SearchResponse>
  getDashboardStats(userId: string): Promise<DashboardStats>
  getProjects(userId: string): Promise<ProjectStats[]>
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
