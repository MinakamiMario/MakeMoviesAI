import styles from './Badge.module.css';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'accent';

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

export default function Badge({
  children,
  variant = 'default',
  className,
}: Props) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`}>
      {children}
    </span>
  );
}
