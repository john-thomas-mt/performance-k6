export type TaskItem = {
  category: string;
  [key: string]: unknown;
};

export type TasksResponse = {
  totalCount: number;
  items: TaskItem[];
};
