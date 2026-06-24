export interface TaskItem {
  category: string;
  [key: string]: unknown;
}

export interface TasksResponse {
  totalCount: number;
  items: TaskItem[];
}
