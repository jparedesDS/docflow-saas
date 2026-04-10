import { motion, AnimatePresence } from 'framer-motion';
import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import { useI18n } from '../contexts/I18nContext';

export default function ErrorBanner({ error, onRetry, onDismiss }) {
  const { t } = useI18n();
  if (!error) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center gap-3 px-4 py-3 rounded-lg border"
        style={{
          background: 'var(--bg-card)',
          borderColor: '#DC2626',
          color: '#DC2626',
        }}
      >
        <WarningCircle size={20} weight="bold" />
        <span className="flex-1 text-sm">{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            style={{ background: '#DC262615', color: '#DC2626' }}
          >
            <ArrowClockwise size={14} weight="bold" />
            {t('retry')}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-xs opacity-50 hover:opacity-100">
            &#10005;
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
