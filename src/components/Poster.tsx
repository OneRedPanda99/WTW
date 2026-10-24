import Image from "next/image";

type Props = {
  path: string | null;
  title: string;
  size?: "w185" | "w342" | "w500";
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export default function Poster({ path, title, size = "w342", className = "", priority, sizes = "200px" }: Props) {
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ${className}`}>
      {path ? (
        <Image
          src={`https://image.tmdb.org/t/p/${size}${path}`}
          alt={title}
          fill
          sizes={sizes}
          priority={priority}
          draggable={false}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-sm text-zinc-500">{title}</div>
      )}
    </div>
  );
}
