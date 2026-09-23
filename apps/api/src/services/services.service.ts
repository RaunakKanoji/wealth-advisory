import * as servicesRepository from "../db/repositories/services.repository.js";
import * as auditRepository from "../db/repositories/audit.repository.js";
import { id } from "../lib/ids.js";
import { ApiError } from "../lib/errors.js";

function serviceDto(service: Awaited<ReturnType<typeof servicesRepository.listServices>>[number], isFavorite: boolean) {
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    description: service.description,
    category: service.category,
    iconKey: service.iconKey,
    iconTone: service.iconTone,
    route: service.route,
    searchTerms: service.searchTermsJson,
    isFavorite,
    displayOrder: service.displayOrder,
  };
}

export async function listServices(userId: string, category?: string) {
  const [services, favorites] = await Promise.all([
    servicesRepository.listServices(category),
    servicesRepository.listFavorites(userId),
  ]);
  const favoriteIds = new Set(favorites.map((item) => item.service.id));
  return {
    items: services.map((service) => serviceDto(service, favoriteIds.has(service.id))),
  };
}

export async function listFavorites(userId: string) {
  return { items: (await servicesRepository.listFavorites(userId)).map((item) => serviceDto(item.service, true)) };
}

export async function addFavorite(userId: string, serviceId: string) {
  const service = await servicesRepository.getService(serviceId);
  if (!service) throw new ApiError("SERVICE_NOT_FOUND", "Service not found.", 404);
  const favorite = await servicesRepository.addFavorite({ id: id("favorite"), userId, serviceId });
  if (favorite) await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "service_favorited", entityType: "service", entityId: serviceId, metadataJson: {} });
  return { serviceId, isFavorite: true };
}

export async function removeFavorite(userId: string, serviceId: string) {
  await servicesRepository.removeFavorite(userId, serviceId);
  await auditRepository.insertAuditEvent({ id: id("audit"), userId, eventType: "service_unfavorited", entityType: "service", entityId: serviceId, metadataJson: {} });
  return { serviceId, isFavorite: false };
}
