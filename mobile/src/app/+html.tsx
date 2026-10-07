import { ScrollViewStyleReset } from "expo-router/html";
import { colors } from "../constants/theme";

// Customizes the root HTML for the web build. Sets the page background to
// match the app's own dark theme so the margin outside the centered content
// column (see _layout.tsx's webContentStyle) doesn't flash the browser's
// default white/light background.
export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: ${colors.background}; }` }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
