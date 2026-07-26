import { Composition } from "remotion";
import { MyComposition, CompositionSchema } from "./MyComposition";

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="MyComp"
                component={MyComposition}
                durationInFrames={60 * 30} // 60 seconds at 30fps
                fps={30}
                width={1080}
                height={1920} // 9:16 aspect ratio
                schema={CompositionSchema}
                defaultProps={{
                    scenes: [
                        {
                            text: "Welcome to your AI video generator!",
                            duration: 3,
                            visual: "Intro screen"
                        },
                        {
                            text: "Enter a topic to generate a script.",
                            duration: 3,
                            visual: "Typing on keyboard"
                        }
                    ],
                }}
            />
        </>
    );
};
