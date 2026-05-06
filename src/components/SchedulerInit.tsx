import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { startScheduler, stopScheduler } from '@/lib/scheduler';

export function SchedulerInit() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      startScheduler();
    } else {
      stopScheduler();
    }
    return () => stopScheduler();
  }, [isAuthenticated]);

  return null;
}
