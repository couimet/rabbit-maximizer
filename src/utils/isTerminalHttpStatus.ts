import { StatusCodes } from 'http-status-codes';

export const TERMINAL_HTTP_STATUSES = [StatusCodes.NOT_FOUND, StatusCodes.GONE] as const;

export const isTerminalHttpStatus = (status: number | undefined): boolean => TERMINAL_HTTP_STATUSES.includes(status as number);
