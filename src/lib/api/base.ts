export type ApiResponse<T = void> = {
  data: T;
  message: string;
  success: boolean;
};

export type PaginatedResponse<T> = {
  current_page: number;
  data: T[];
  last_page: number;
  total: number;
};
