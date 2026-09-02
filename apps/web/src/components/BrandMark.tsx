type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      draggable={false}
      src="/pagealong-mark-book-headphones.svg"
    />
  );
}

export default BrandMark;
