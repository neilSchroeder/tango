# Tango Puzzle Game - Web Application

A modern web implementation of the Tango puzzle game featuring a FastAPI backend and Svelte frontend with Tailwind CSS, enhanced with intelligent puzzle generation and inference-based solving.

## Game Description

Tango is a 6x6 grid logic puzzle game where you place suns (☀) and moons (☽) following specific rules, similar to Sudoku but with unique constraints. The game emphasizes logical deduction and pattern recognition.

## Game Rules

1. **Balance Rule**: Each row and column must contain exactly 3 suns and 3 moons
2. **Consecutive Rule**: No three consecutive identical pieces are allowed in any row or column  
3. **×** constraint between tiles means they must contain different pieces
4. **=** constraint between tiles means they must contain the same piece

## Web Controls

- **Click tiles** to cycle through: Empty → ☀ → ☽ → Empty
- **New Game** button generates a fresh puzzle with intelligent constraint optimization
- **Hint System** provides educational explanations based on game rules
- **Real-time validation** shows rule violations with detailed feedback
- **Timer** tracks your solving speed
- **Leaderboard** displays best completion times

## Frontend Setup  
```bash
cd frontend
npm install
npm run dev
```

Then open the local browser that starts to play.


## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`  
5. Open a pull request

## License

MIT License - see LICENSE file for details.

## Original Game

Based on the Tango puzzle game concept, implemented as a modern web application with enhanced features, intelligent puzzle generation, and educational hint systems.
