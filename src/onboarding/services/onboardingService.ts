import { onboardingRepository } from "../repositories/onboardingRepository.js";

export class OnboardingService {
  async checkStatus(userId: string): Promise<boolean> {
    const status = await onboardingRepository.getStatus(userId);
    return status?.isCompleted ?? false;
  }

  async completeOnboarding(userId: string): Promise<void> {
    await onboardingRepository.markCompleted(userId);
  }
}

export const onboardingService = new OnboardingService();
