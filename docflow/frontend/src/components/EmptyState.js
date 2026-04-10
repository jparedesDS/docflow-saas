import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      {Icon && (
        <div className="mb-4 opacity-30">
          <Icon size={64} weight="thin" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-main)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-md mb-6" style={{ color: 'var(--text-secondary, #64748b)' }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--accent, #4F46E5)' }}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
