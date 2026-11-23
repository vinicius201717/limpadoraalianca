"use client";

import { Box } from "@mui/material";

const bubbles = [
  { size: 8, left: "9%", bottom: 10, delay: "0s", duration: "3.4s", drift: "8px", returnDrift: "-3px" },
  { size: 5, left: "24%", bottom: 5, delay: ".55s", duration: "3s", drift: "-6px", returnDrift: "2px" },
  { size: 11, left: "40%", bottom: 12, delay: "1.05s", duration: "3.8s", drift: "10px", returnDrift: "-4px" },
  { size: 6, left: "57%", bottom: 7, delay: ".25s", duration: "3.2s", drift: "-8px", returnDrift: "3px" },
  { size: 13, left: "73%", bottom: 14, delay: ".9s", duration: "4s", drift: "7px", returnDrift: "-2px" },
  { size: 7, left: "88%", bottom: 6, delay: "1.45s", duration: "3.5s", drift: "-5px", returnDrift: "2px" },
];

export function SoapBubbleStatusEffect() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: { xs: "8px 8px auto auto", sm: "10px 14px auto auto" },
        width: { xs: 112, sm: 148 },
        height: { xs: 44, sm: 58 },
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.95,
        overflow: "hidden",
        "@keyframes soapBubbleFloat": {
          "0%": { transform: "translate3d(0, 8px, 0) scale(.72)", opacity: 0 },
          "18%": { opacity: 0.75 },
          "62%": { transform: "translate3d(var(--bubble-drift), -8px, 0) scale(1)", opacity: 0.58 },
          "100%": { transform: "translate3d(var(--bubble-return), -22px, 0) scale(.84)", opacity: 0 },
        },
        "@keyframes soapBubbleGleam": {
          "0%, 100%": { opacity: 0.35, transform: "scale(.72)" },
          "50%": { opacity: 0.9, transform: "scale(1)" },
        },
      }}
    >
      {bubbles.map((bubble, index) => (
        <Box
          key={`${bubble.left}-${bubble.size}`}
          component="span"
          sx={{
            "--bubble-drift": bubble.drift,
            "--bubble-return": bubble.returnDrift,
            position: "absolute",
            left: bubble.left,
            bottom: bubble.bottom,
            width: bubble.size,
            height: bubble.size,
            borderRadius: "50%",
            border: "1px solid rgba(0, 168, 232, .38)",
            background: "radial-gradient(circle at 30% 28%, rgba(255,255,255,.96) 0 16%, rgba(255,255,255,.38) 17% 34%, rgba(0,168,232,.16) 35% 100%)",
            boxShadow: "0 0 10px rgba(0, 168, 232, .16), inset -2px -3px 5px rgba(37, 199, 131, .18)",
            animation: `soapBubbleFloat ${bubble.duration} ease-in-out ${bubble.delay} infinite`,
            "&::after": {
              content: '""',
              position: "absolute",
              top: "18%",
              left: "22%",
              width: Math.max(2, Math.round(bubble.size * 0.26)),
              height: Math.max(2, Math.round(bubble.size * 0.26)),
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,.92)",
              animation: `soapBubbleGleam 1.8s ease-in-out ${index * 0.18}s infinite`,
            },
          }}
        />
      ))}
    </Box>
  );
}
