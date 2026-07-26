import { AbsoluteFill, Series } from "remotion";
import { z } from "zod";

export const SceneSchema = z.object({
    text: z.string(),
    duration: z.number(), // in seconds
    visual: z.string().optional(),
});

export const CompositionSchema = z.object({
    scenes: z.array(SceneSchema),
});

export const MyComposition: React.FC<z.infer<typeof CompositionSchema>> = ({
    scenes,
}) => {
    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            <Series>
                {scenes.map((scene, index) => (
                    <Series.Sequence key={index} durationInFrames={Math.round(scene.duration * 30)}>
                        {/* assuming 30fps for calculation, but Series handles relative. Wait, durationInFrames must be explicit frames. */}
                        <Scene text={scene.text} visual={scene.visual} />
                    </Series.Sequence>
                ))}
            </Series>
        </AbsoluteFill>
    );
};

const Scene: React.FC<{ text: string; visual?: string }> = ({ text, visual }) => {
    return (
        <AbsoluteFill
            style={{
                justifyContent: "center",
                alignItems: "center",
                padding: 50,
            }}
        >
            {/* Placeholder for visual - maybe a gradient or image later */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom right, #4facfe 0%, #00f2fe 100%)',
                zIndex: -1
            }} />

            <h1
                style={{
                    color: "white",
                    fontSize: 80,
                    textAlign: "center",
                    fontFamily: "sans-serif",
                    textShadow: "0 4px 10px rgba(0,0,0,0.5)",
                }}
            >
                {text}
            </h1>
            {visual && <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 20, fontSize: 30 }}>Visual cue: {visual}</p>}
        </AbsoluteFill>
    );
};
