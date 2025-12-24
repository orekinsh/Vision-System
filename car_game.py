#!/usr/bin/env python3
"""
Simple 2D Car Racing Game
Navigate your car through traffic and avoid collisions!

Controls:
- Arrow Keys or WASD: Move car left/right
- Space: Restart game after game over
- ESC: Quit game
"""

import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Screen dimensions
SCREEN_WIDTH = 500
SCREEN_HEIGHT = 700

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 100, 255)
GRAY = (100, 100, 100)
DARK_GRAY = (50, 50, 50)
YELLOW = (255, 255, 0)
ORANGE = (255, 165, 0)

# Game settings
FPS = 60
ROAD_WIDTH = 300
LANE_COUNT = 3
LANE_WIDTH = ROAD_WIDTH // LANE_COUNT

# Car dimensions
CAR_WIDTH = 50
CAR_HEIGHT = 90

# Road boundaries
ROAD_LEFT = (SCREEN_WIDTH - ROAD_WIDTH) // 2
ROAD_RIGHT = ROAD_LEFT + ROAD_WIDTH


class Car:
    """Base car class for player and obstacles"""

    def __init__(self, x, y, color, width=CAR_WIDTH, height=CAR_HEIGHT):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.color = color
        self.speed = 5

    def draw(self, screen):
        """Draw the car as a simple rectangle with details"""
        # Car body
        pygame.draw.rect(screen, self.color,
                        (self.x, self.y, self.width, self.height),
                        border_radius=10)

        # Car roof/cabin
        cabin_width = self.width - 10
        cabin_height = self.height // 3
        cabin_x = self.x + 5
        cabin_y = self.y + self.height // 3
        pygame.draw.rect(screen, DARK_GRAY,
                        (cabin_x, cabin_y, cabin_width, cabin_height),
                        border_radius=5)

        # Headlights/taillights
        light_size = 8
        pygame.draw.rect(screen, YELLOW,
                        (self.x + 5, self.y + 5, light_size, light_size))
        pygame.draw.rect(screen, YELLOW,
                        (self.x + self.width - 13, self.y + 5, light_size, light_size))

        # Rear lights
        pygame.draw.rect(screen, RED,
                        (self.x + 5, self.y + self.height - 13, light_size, light_size))
        pygame.draw.rect(screen, RED,
                        (self.x + self.width - 13, self.y + self.height - 13, light_size, light_size))

    def get_rect(self):
        """Return the bounding rectangle for collision detection"""
        return pygame.Rect(self.x, self.y, self.width, self.height)


class PlayerCar(Car):
    """Player-controlled car"""

    def __init__(self):
        # Start in the middle lane
        start_x = ROAD_LEFT + LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) // 2
        start_y = SCREEN_HEIGHT - CAR_HEIGHT - 50
        super().__init__(start_x, start_y, BLUE)
        self.speed = 8

    def move(self, direction):
        """Move the car left or right"""
        if direction == "left":
            self.x -= self.speed
        elif direction == "right":
            self.x += self.speed

        # Keep car within road boundaries
        self.x = max(ROAD_LEFT + 5, min(self.x, ROAD_RIGHT - self.width - 5))


class ObstacleCar(Car):
    """Obstacle cars that move down the screen"""

    def __init__(self, lane, speed):
        # Random color for variety
        colors = [RED, GREEN, ORANGE, (128, 0, 128), (0, 128, 128)]
        color = random.choice(colors)

        # Position in the specified lane
        x = ROAD_LEFT + lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) // 2
        y = -CAR_HEIGHT

        super().__init__(x, y, color)
        self.speed = speed

    def move(self):
        """Move the car down the screen"""
        self.y += self.speed

    def is_off_screen(self):
        """Check if car has moved off the bottom of the screen"""
        return self.y > SCREEN_HEIGHT


class Road:
    """The road with lane markings"""

    def __init__(self):
        self.marking_offset = 0
        self.marking_speed = 5

    def update(self, speed):
        """Update the road markings animation"""
        self.marking_offset += speed
        if self.marking_offset >= 50:
            self.marking_offset = 0

    def draw(self, screen):
        """Draw the road and lane markings"""
        # Road background
        pygame.draw.rect(screen, GRAY,
                        (ROAD_LEFT, 0, ROAD_WIDTH, SCREEN_HEIGHT))

        # Road edges (white lines)
        pygame.draw.line(screen, WHITE,
                        (ROAD_LEFT, 0), (ROAD_LEFT, SCREEN_HEIGHT), 5)
        pygame.draw.line(screen, WHITE,
                        (ROAD_RIGHT, 0), (ROAD_RIGHT, SCREEN_HEIGHT), 5)

        # Lane markings (dashed lines)
        marking_height = 30
        marking_gap = 20

        for lane in range(1, LANE_COUNT):
            x = ROAD_LEFT + lane * LANE_WIDTH
            y = -marking_height + self.marking_offset

            while y < SCREEN_HEIGHT:
                pygame.draw.rect(screen, WHITE,
                               (x - 2, y, 4, marking_height))
                y += marking_height + marking_gap


class Game:
    """Main game class"""

    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("2D Car Racing Game")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.big_font = pygame.font.Font(None, 72)
        self.reset_game()

    def reset_game(self):
        """Reset the game state"""
        self.player = PlayerCar()
        self.obstacles = []
        self.road = Road()
        self.score = 0
        self.game_speed = 5
        self.spawn_timer = 0
        self.spawn_delay = 60  # Frames between spawns
        self.game_over = False
        self.high_score = getattr(self, 'high_score', 0)

    def spawn_obstacle(self):
        """Spawn a new obstacle car"""
        lane = random.randint(0, LANE_COUNT - 1)

        # Check if lane is clear near the top
        for obstacle in self.obstacles:
            if abs(obstacle.x - (ROAD_LEFT + lane * LANE_WIDTH)) < CAR_WIDTH:
                if obstacle.y < CAR_HEIGHT + 50:
                    return  # Lane not clear

        obstacle = ObstacleCar(lane, self.game_speed)
        self.obstacles.append(obstacle)

    def check_collision(self):
        """Check for collision between player and obstacles"""
        player_rect = self.player.get_rect()

        for obstacle in self.obstacles:
            if player_rect.colliderect(obstacle.get_rect()):
                return True
        return False

    def update(self):
        """Update game state"""
        if self.game_over:
            return

        # Spawn obstacles
        self.spawn_timer += 1
        if self.spawn_timer >= self.spawn_delay:
            self.spawn_obstacle()
            self.spawn_timer = 0

        # Update obstacles
        for obstacle in self.obstacles[:]:
            obstacle.move()
            if obstacle.is_off_screen():
                self.obstacles.remove(obstacle)
                self.score += 10

        # Update road animation
        self.road.update(self.game_speed)

        # Check collision
        if self.check_collision():
            self.game_over = True
            if self.score > self.high_score:
                self.high_score = self.score

        # Increase difficulty over time
        if self.score > 0 and self.score % 100 == 0:
            self.game_speed = min(15, 5 + self.score // 100)
            self.spawn_delay = max(30, 60 - self.score // 50)

    def draw(self):
        """Draw everything to the screen"""
        # Background
        self.screen.fill(GREEN)

        # Road
        self.road.draw(self.screen)

        # Obstacles
        for obstacle in self.obstacles:
            obstacle.draw(self.screen)

        # Player
        self.player.draw(self.screen)

        # Score
        score_text = self.font.render(f"Score: {self.score}", True, WHITE)
        self.screen.blit(score_text, (10, 10))

        # High score
        high_score_text = self.font.render(f"High Score: {self.high_score}", True, WHITE)
        self.screen.blit(high_score_text, (10, 50))

        # Speed indicator
        speed_text = self.font.render(f"Speed: {self.game_speed}", True, WHITE)
        self.screen.blit(speed_text, (SCREEN_WIDTH - 120, 10))

        # Game over screen
        if self.game_over:
            # Semi-transparent overlay
            overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
            overlay.fill(BLACK)
            overlay.set_alpha(150)
            self.screen.blit(overlay, (0, 0))

            # Game over text
            game_over_text = self.big_font.render("GAME OVER", True, RED)
            text_rect = game_over_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 50))
            self.screen.blit(game_over_text, text_rect)

            # Final score
            final_score_text = self.font.render(f"Final Score: {self.score}", True, WHITE)
            score_rect = final_score_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20))
            self.screen.blit(final_score_text, score_rect)

            # Restart instruction
            restart_text = self.font.render("Press SPACE to restart", True, YELLOW)
            restart_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 70))
            self.screen.blit(restart_text, restart_rect)

        pygame.display.flip()

    def handle_events(self):
        """Handle user input"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    return False
                if event.key == pygame.K_SPACE and self.game_over:
                    self.reset_game()

        # Continuous key presses for movement
        if not self.game_over:
            keys = pygame.key.get_pressed()
            if keys[pygame.K_LEFT] or keys[pygame.K_a]:
                self.player.move("left")
            if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
                self.player.move("right")

        return True

    def run(self):
        """Main game loop"""
        running = True
        while running:
            running = self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)

        pygame.quit()
        sys.exit()


def main():
    """Entry point"""
    print("Starting 2D Car Racing Game...")
    print("\nControls:")
    print("  Arrow Keys or A/D: Move left/right")
    print("  Space: Restart after game over")
    print("  ESC: Quit")
    print("\nAvoid the oncoming traffic and score points!")

    game = Game()
    game.run()


if __name__ == "__main__":
    main()
