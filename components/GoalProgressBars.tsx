'use client';

interface Props {
  seasonProgress: number;  // 0~100
  achievement: number;     // 0~100
  totalGoal: number;
  accumulated: number;
  compact?: boolean;       // true = 작은 버전 (dashboard row용)
}

export default function GoalProgressBars({ seasonProgress, achievement, totalGoal, accumulated, compact }: Props) {
  const isAhead = achievement >= seasonProgress;
  const goalColor = isAhead ? '#34D399' : '#F87171';
  const goalBg    = isAhead ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)';

  if (compact) {
    return (
      <div className="space-y-1 w-full">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-6 text-right">시즌</span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, seasonProgress)}%` }} />
          </div>
          <span className="text-[9px] text-gray-400 tabular-nums w-10 text-right">{seasonProgress}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-6 text-right">목표</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: goalBg }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, achievement)}%`, background: goalColor }} />
          </div>
          <span className="text-[9px] tabular-nums w-10 text-right" style={{ color: goalColor }}>{achievement}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">시즌</span>
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, seasonProgress)}%` }} />
        </div>
        <span className="text-xs text-blue-600 font-bold tabular-nums w-12 text-right">{seasonProgress}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">목표</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: goalBg }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, achievement)}%`, background: goalColor }} />
        </div>
        <span className="text-xs font-bold tabular-nums w-12 text-right" style={{ color: goalColor }}>{achievement}%</span>
      </div>
      <p className="text-xs text-gray-500 text-center">
        총목표 {totalGoal}h 중 {accumulated}h 달성 {isAhead ? '✅' : '⚠️'}
      </p>
    </div>
  );
}
