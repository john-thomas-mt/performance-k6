export type TaskItem = {
  category: string;
};

export type TasksResponse = {
  totalCount: number;
  items: TaskItem[];
};
