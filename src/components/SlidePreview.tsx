import type { SlideScene } from "../lib/designScene";

export default function SlidePreview({
  scene,
  label,
}: {
  scene: SlideScene;
  label: string;
}) {
  return (
    <svg
      className="slide-design-preview"
      viewBox="0 0 960 540"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={960} height={540} fill={`#${scene.background}`} />
      {scene.elements.map((element, index) => {
        if (element.kind === "shape")
          return element.shape === "ellipse" ? (
            <ellipse
              key={index}
              cx={element.x + element.w / 2}
              cy={element.y + element.h / 2}
              rx={element.w / 2}
              ry={element.h / 2}
              fill={`#${element.fill}`}
            />
          ) : (
            <rect
              key={index}
              x={element.x}
              y={element.y}
              width={element.w}
              height={element.h}
              fill={`#${element.fill}`}
            />
          );
        if (element.kind === "image")
          return (
            <image
              key={index}
              href={element.dataUrl}
              x={element.x}
              y={element.y}
              width={element.w}
              height={element.h}
              preserveAspectRatio="xMidYMid meet"
            >
              <title>{element.alt}</title>
            </image>
          );
        return (
          <foreignObject
            key={index}
            x={element.x}
            y={element.y}
            width={element.w}
            height={element.h}
          >
            <div
              style={{
                color: `#${element.color}`,
                fontFamily: `${element.font}, Arial, sans-serif`,
                fontSize: element.size,
                fontWeight: element.bold ? 700 : 400,
                textAlign: element.align,
                lineHeight: 1.25,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                margin: 0,
                padding: 0,
              }}
            >
              {element.text}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}
