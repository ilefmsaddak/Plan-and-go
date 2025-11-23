from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Plan, Comment, Like, Notification, UserProfile, User, Publication, PlanSnapshot, Reply, Reaction
from datetime import datetime
import uuid

@csrf_exempt
def health(request):
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """Inscription utilisateur"""
    try:
        body = json.loads(request.body)
        username = body.get('username')
        email = body.get('email')
        password = body.get('password')
        
        # Validation
        if not username or not email or not password:
            return JsonResponse({
                'success': False,
                'message': 'Tous les champs sont obligatoires'
            }, status=400)
        
        # Vérifier si l'utilisateur existe déjà
        if User.objects(email=email):
            return JsonResponse({
                'success': False,
                'message': 'Cet email est déjà utilisé'
            }, status=400)
        
        if User.objects(username=username):
            return JsonResponse({
                'success': False,
                'message': 'Ce nom d\'utilisateur est déjà pris'
            }, status=400)
        
        # Créer l'utilisateur
        user_id = f"user_{uuid.uuid4().hex[:8]}"
        user = User(
            userId=user_id,
            username=username,
            email=email,
            isActive=True
        )
        user.set_password(password)
        user.save()
        
        # Créer le profil utilisateur avec la nouvelle structure
        profile = UserProfile(
            user_id=user_id,
            username=username,
            email=email,
            bio="",
            avatar_url="",
            followers=[],
            following=[]
        )
        profile.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Compte créé avec succès',
            'userId': user.userId,
            'username': user.username,
            'email': user.email,
            'isActive': user.isActive,
            'createdAt': user.createdAt.isoformat() if user.createdAt else None,
            'lastLoginAt': user.lastLoginAt.isoformat() if user.lastLoginAt else None
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    """Connexion utilisateur"""
    try:
        body = json.loads(request.body)
        email = body.get('email')
        password = body.get('password')
        
        # Validation
        if not email or not password:
            return JsonResponse({
                'success': False,
                'message': 'Email et mot de passe obligatoires'
            }, status=400)
        
        # Trouver l'utilisateur
        user = User.objects(email=email).first()
        if not user:
            return JsonResponse({
                'success': False,
                'message': 'Email ou mot de passe incorrect'
            }, status=401)
        
        # Vérifier le mot de passe
        if not user.check_password(password):
            return JsonResponse({
                'success': False,
                'message': 'Email ou mot de passe incorrect'
            }, status=401)
        
        # Mettre à jour lastLoginAt
        user.lastLoginAt = datetime.utcnow()
        user.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Connexion réussie',
            'userId': user.userId,
            'username': user.username,
            'email': user.email,
            'token': user.userId
        }, status=200)
        
    except Exception as e:
        print(f"ERREUR dans login: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def plans_list(request):
    """GET: récupère tous les plans publics (sauf ceux de l'utilisateur)"""
    
    try:
        user_id = request.GET.get("user_id", None)
        
        # Récupère tous les plans publics
        all_plans = Plan.objects(is_public=True)
        
        # Exclut les plans de l'utilisateur courant
        if user_id:
            plans = [p for p in all_plans if p.author_id != user_id]
        else:
            plans = list(all_plans)
        
        data = []
        for plan in plans:
            try:
                # Get username from UserProfile
                author_username = "Voyageur"
                if plan.author_id:
                    try:
                        author_profile = UserProfile.objects.get(user_id=plan.author_id)
                        author_username = author_profile.username
                    except UserProfile.DoesNotExist:
                        author_username = str(plan.author_name) if plan.author_name else "Voyageur"
                
                created_at = ""
                if hasattr(plan, 'created_at') and plan.created_at:
                    created_at = plan.created_at.isoformat()
                
                plan_data = {
                    "id": str(plan.id) if plan.id else "",
                    "city": str(plan.city) if plan.city else "",
                    "author": author_username,
                    "authorId": str(plan.author_id) if plan.author_id else "",
                    "fromDate": plan.from_date.isoformat() if plan.from_date else "",
                    "toDate": plan.to_date.isoformat() if plan.to_date else "",
                    "placesCount": len(plan.place_bucket) if plan.place_bucket else 0,
                    "daysCount": len(plan.itinerary) if plan.itinerary else 0,
                    "createdAt": created_at,
                }
                
                data.append(plan_data)
            except Exception as e:
                print(f"Erreur lors du traitement du plan: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
        
        return JsonResponse(data, safe=False)
        
    except Exception as e:
        print(f"ERREUR dans plans_list: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_plan(request):
    try:
        body = json.loads(request.body)
        plan = Plan(
            author_id=body.get("author_id"),
            author_name=body.get("author_name"),
            is_public=body.get("is_public", False),
            city=body.get("city"),
            from_date=body.get("from_date"),
            to_date=body.get("to_date"),
        )
        plan.save()
        
        # Ajoute le plan au profil utilisateur
        profile = UserProfile.objects(user_id=body.get("author_id")).first()

        
        return JsonResponse({
            "id": str(plan.id),
            "message": "Plan créé avec succès"
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def plan_detail(request, plan_id):
    """Récupère les détails d'un plan avec commentaires et usernames des likes"""
    try:
        plan = Plan.objects.get(id=plan_id)
        
        # Construire les commentaires avec replies et reactions
        comments_data = []
        if hasattr(plan, 'comments') and plan.comments:
            for comment in plan.comments:
                # Construire les replies
                replies_data = []
                if hasattr(comment, 'replies') and comment.replies:
                    for reply in comment.replies:
                        replies_data.append({
                            "id": reply.id,
                            "author_id": reply.author_id,
                            "author_name": reply.author_name,
                            "text": reply.text,
                            "created_at": reply.created_at.isoformat() if hasattr(reply, 'created_at') and reply.created_at else ""
                        })
                
                # Construire les reactions
                reactions_data = []
                if hasattr(comment, 'reactions') and comment.reactions:
                    for reaction in comment.reactions:
                        reactions_data.append({
                            "id": reaction.id,
                            "author_id": reaction.author_id,
                            "author_name": reaction.author_name,
                            "type": reaction.type,
                            "created_at": reaction.created_at.isoformat() if hasattr(reaction, 'created_at') and reaction.created_at else ""
                        })
                
                comments_data.append({
                    "id": comment.id,
                    "author": comment.author_name,
                    "authorId": comment.author_id,
                    "text": comment.text,
                    "createdAt": comment.created_at.isoformat() if hasattr(comment, 'created_at') and comment.created_at else "",
                    "replies": replies_data,
                    "reactions": reactions_data
                })
        
        # Récupérer les usernames des likes
        likes_data = []
        for like in plan.likes:
            try:
                user = User.objects.get(userId=like.user_id)
                likes_data.append(user.username)
            except User.DoesNotExist:
                # Si l'utilisateur n'existe pas, utiliser l'ID
                likes_data.append(like.user_id)
        
        # Récupérer le nom d'auteur
        author_username = "Voyageur"
        if plan.author_id:
            try:
                author_profile = UserProfile.objects.get(user_id=plan.author_id)
                author_username = author_profile.username
            except UserProfile.DoesNotExist:
                author_username = str(plan.author_name) if plan.author_name else "Voyageur"
        
        # Récupérer les champs optionnels de manière sûre
        place_bucket = getattr(plan, 'place_bucket', None)
        city = getattr(plan, 'city', None)
        from_date = getattr(plan, 'from_date', None)
        to_date = getattr(plan, 'to_date', None)
        
        data = {
            "id": str(plan.id),
            "title": plan.title,
            "description": plan.description,
            "location": plan.location,
            "author": author_username,
            "authorId": plan.author_id,
            "likes": plan.get_likes_count(),
            "likedBy": likes_data,
            "comments": comments_data,
            "clonedBy": plan.cloned_by,
            "createdAt": plan.created_at.isoformat(),
            "place_bucket": place_bucket if place_bucket and place_bucket.strip() else None,
            "city": city if city and city.strip() else None,
            "from_date": from_date if from_date and from_date.strip() else None,
            "to_date": to_date if to_date and to_date.strip() else None,
        }
        
        return JsonResponse(data)
    except Plan.DoesNotExist:
        return JsonResponse({"error": "Plan non trouvé"}, status=404)

@csrf_exempt
@require_http_methods(["POST"])
def like_plan(request, plan_id):
    """Ajoute ou retire un like sur un plan"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        
        plan = Plan.objects.get(id=plan_id)
        
        # Vérifie si l'utilisateur a déjà liké
        existing_like = next((like for like in plan.likes if like.user_id == user_id), None)
        
        if existing_like:
            # Retire le like
            plan.likes.remove(existing_like)
        else:
            # Ajoute le like
            like = Like(user_id=user_id)
            plan.likes.append(like)
            
            # Crée une notification
            if plan.author_id != user_id:
                notification = Notification(
                    recipient_id=plan.author_id,
                    sender_id=user_id,
                    sender_name=user_name,
                    action_type="like",
                    plan_id=str(plan.id),
                    plan_title=plan.title,
                    message=f"{user_name} a aimé votre plan: {plan.title}"
                )
                notification.save()
        
        # Nettoyer et valider les commentaires avant de sauvegarder
        try:
            if hasattr(plan, 'comments') and plan.comments:
                for comment in plan.comments:
                    # Assurer que created_at existe
                    if not hasattr(comment, 'created_at') or comment.created_at is None:
                        comment.created_at = datetime.utcnow()
                    
                    # Nettoyer les replies
                    if hasattr(comment, 'replies') and comment.replies:
                        for reply in comment.replies:
                            if not hasattr(reply, 'created_at') or reply.created_at is None:
                                reply.created_at = datetime.utcnow()
                    
                    # Nettoyer les reactions
                    if hasattr(comment, 'reactions') and comment.reactions:
                        for reaction in comment.reactions:
                            if not hasattr(reaction, 'created_at') or reaction.created_at is None:
                                reaction.created_at = datetime.utcnow()
            
            plan.save()
        except Exception as save_error:
            print(f"Erreur lors de la sauvegarde du plan: {str(save_error)}")
            import traceback
            traceback.print_exc()
            raise
        
        return JsonResponse({
            "likes": plan.get_likes_count(),
            "isLiked": not existing_like
        })
    except Exception as e:
        print(f"Erreur lors du like: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_comment(request, plan_id):
    """Ajoute un commentaire sur un plan"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        text = body.get("text")
        
        plan = Plan.objects.get(id=plan_id)
        
        comment = Comment(
            id=str(len(plan.comments) + 1),
            author_id=user_id,
            author_name=user_name,
            text=text,
            created_at=datetime.utcnow()
        )
        plan.comments.append(comment)
        plan.save()
        
        # Crée une notification
        if plan.author_id != user_id:
            notification = Notification(
                recipient_id=plan.author_id,
                sender_id=user_id,
                sender_name=user_name,
                action_type="comment",
                plan_id=str(plan.id),
                plan_title=plan.title,
                message=f"{user_name} a commenté votre plan: {plan.title}"
            )
            notification.save()
        
        return JsonResponse({
            "id": comment.id,
            "author": comment.author_name,
            "text": comment.text,
            "createdAt": comment.created_at.isoformat(),
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_reply(request, plan_id, comment_id):
    """Ajoute une réponse à un commentaire"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        text = body.get("text")
        
        plan = Plan.objects.get(id=plan_id)
        
        # Trouver le commentaire
        comment = None
        for c in plan.comments:
            if c.id == comment_id:
                comment = c
                break
        
        if not comment:
            return JsonResponse({"error": "Commentaire non trouvé"}, status=404)
        
        # Créer la réponse
        from social.models import Reply
        reply = Reply(
            id=str(len(comment.replies) + 1),
            author_id=user_id,
            author_name=user_name,
            text=text,
            created_at=datetime.utcnow()
        )
        comment.replies.append(reply)
        plan.save()
        
        return JsonResponse({
            "id": reply.id,
            "author": reply.author_name,
            "text": reply.text,
            "createdAt": reply.created_at.isoformat(),
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_reaction(request, plan_id, comment_id):
    """Ajoute une réaction à un commentaire"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        emoji = body.get("emoji")
        
        plan = Plan.objects.get(id=plan_id)
        
        # Trouver le commentaire
        comment = None
        for c in plan.comments:
            if c.id == comment_id:
                comment = c
                break
        
        if not comment:
            return JsonResponse({"error": "Commentaire non trouvé"}, status=404)
        
        # Créer la réaction
        from social.models import Reaction
        reaction = Reaction(
            id=str(len(comment.reactions) + 1),
            author_id=user_id,
            author_name=user_name,
            type=emoji,
            created_at=datetime.utcnow()
        )
        comment.reactions.append(reaction)
        plan.save()
        
        return JsonResponse({
            "id": reaction.id,
            "author": reaction.author_name,
            "type": reaction.type,
            "createdAt": reaction.created_at.isoformat(),
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def clone_plan(request, plan_id):
    """Clone un plan dans la collection de l'utilisateur"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        
        original_plan = Plan.objects.get(id=plan_id)
        
        # Crée une copie du plan
        cloned_plan = Plan(
            title=original_plan.title,
            description=original_plan.description,
            location=original_plan.location,
            author_id=user_id,
            author_name=user_name,
            is_public=False,  # Les plans clonés sont privés par défaut
            cloned_from=str(original_plan.id),  # Référence au plan original
            place_bucket=getattr(original_plan, 'place_bucket', None),
            city=getattr(original_plan, 'city', None),
            from_date=getattr(original_plan, 'from_date', None),
            to_date=getattr(original_plan, 'to_date', None),
        )
        cloned_plan.save()
        
        # Ajoute l'utilisateur à la liste des cloneurs
        original_plan.cloned_by.append(user_id)
        original_plan.save()
        
        # Ajoute le plan cloné au profil utilisateur
        profile = UserProfile.objects(user_id=user_id).first()
        if profile:
            profile.cloned_plans.append(str(cloned_plan.id))
            profile.save()
        
        # Crée une notification
        notification = Notification(
            recipient_id=original_plan.author_id,
            sender_id=user_id,
            sender_name=user_name,
            action_type="clone",
            plan_id=str(original_plan.id),
            plan_title=original_plan.title,
            message=f"{user_name} a cloné votre plan: {original_plan.title}"
        )
        notification.save()
        
        return JsonResponse({
            "id": str(cloned_plan.id),
            "message": "Plan cloné avec succès"
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def user_notifications(request, user_id):
    """Récupère les notifications d'un utilisateur"""
    try:
        notifications = Notification.objects(recipient_id=user_id).order_by('-created_at')
        
        data = []
        for notif in notifications:
            # Générer le message si absent (pour les anciennes notifications)
            message = notif.message
            if not message:
                action_prefix = {
                    "like": f"{notif.sender_name} a aimé votre publication",
                    "comment": f"{notif.sender_name} a commenté votre publication",
                    "clone": f"{notif.sender_name} a cloné votre plan"
                }
                base_message = action_prefix.get(notif.action_type, f"{notif.sender_name} a interagi avec votre publication")
                
                # Ajouter la description si disponible
                if notif.description:
                    desc_preview = notif.description[:50] + "..." if len(notif.description) > 50 else notif.description
                    message = f"{base_message}: \"{desc_preview}\""
                else:
                    message = base_message
            
            data.append({
                "id": str(notif.id),
                "sender": notif.sender_name,
                "sender_name": notif.sender_name,
                "senderId": notif.sender_id,
                "sender_id": notif.sender_id,
                "action": notif.action_type,
                "action_type": notif.action_type,
                "pubId": notif.pub_id,
                "pub_id": notif.pub_id,
                "recipientId": user_id,
                "recipient_id": user_id,
                "description": notif.description,
                "message": message,
                "isRead": notif.is_read,
                "is_read": notif.is_read,
                "createdAt": notif.created_at.isoformat(),
                "created_at": notif.created_at.isoformat(),
            })
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def user_profile(request, user_id):
    """Récupère le profil d'un utilisateur"""
    try:
        profile = UserProfile.objects.get(user_id=user_id)
        
        # Récupère les plans publics de l'utilisateur (nouvelle structure)
        public_plans = Plan.objects(author_id=user_id, is_public=True)
        public_plans_data = [
            {
                "id": str(plan.id),
                "city": plan.city,
                "fromDate": plan.from_date.isoformat() if plan.from_date else "",
                "toDate": plan.to_date.isoformat() if plan.to_date else "",
                "placesCount": len(plan.place_bucket) if plan.place_bucket else 0,
                "daysCount": len(plan.itinerary) if plan.itinerary else 0,
                "createdAt": plan.created_at.isoformat() if plan.created_at else "",
            }
            for plan in public_plans
        ]
        
        # Convertir les user_ids en usernames pour followers
        followers_data = []
        if profile.followers:
            for follower_id in profile.followers:
                try:
                    follower_profile = UserProfile.objects.get(user_id=follower_id)
                    followers_data.append({
                        "userId": follower_id,
                        "username": follower_profile.username
                    })
                except UserProfile.DoesNotExist:
                    pass
        
        # Convertir les user_ids en usernames pour following
        following_data = []
        if profile.following:
            for following_id in profile.following:
                try:
                    following_profile = UserProfile.objects.get(user_id=following_id)
                    following_data.append({
                        "userId": following_id,
                        "username": following_profile.username
                    })
                except UserProfile.DoesNotExist:
                    pass
        
        data = {
            "userId": profile.user_id,
            "username": profile.username,
            "email": profile.email,
            "bio": profile.bio,
            "avatarUrl": profile.avatar_url,
            "publicPlans": public_plans_data,
            "followers": len(profile.followers),
            "following": len(profile.following),
            "followersList": followers_data,
            "followingList": following_data,
        }
        
        return JsonResponse(data)
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)

@csrf_exempt
@require_http_methods(["GET"])
def user_private_plans(request, user_id):
    """Récupère les plans privés d'un utilisateur (plans non publics)"""
    try:
        # Récupère tous les plans privés de l'utilisateur (is_public=False)
        private_plans = Plan.objects(author_id=user_id, is_public=False)
        data = [
            {
                "id": str(plan.id),
                "city": plan.city,
                "fromDate": plan.from_date.isoformat() if plan.from_date else "",
                "toDate": plan.to_date.isoformat() if plan.to_date else "",
                "placesCount": len(plan.place_bucket) if plan.place_bucket else 0,
                "daysCount": len(plan.itinerary) if plan.itinerary else 0,
                "isPublic": plan.is_public,
                "createdAt": plan.created_at.isoformat() if plan.created_at else "",
            }
            for plan in private_plans
        ]
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def user_cloned_plans(request, user_id):
    """Récupère les plans clonés d'un utilisateur (plans où cloned_from est défini)"""
    try:
        # Récupère les plans clonés par cet utilisateur (plans où cloned_from est défini)
        cloned_plans = Plan.objects(author_id=user_id, cloned_from__exists=True)
        data = [
            {
                "id": str(plan.id),
                "city": plan.city,
                "fromDate": plan.from_date.isoformat() if plan.from_date else "",
                "toDate": plan.to_date.isoformat() if plan.to_date else "",
                "placesCount": len(plan.place_bucket) if plan.place_bucket else 0,
                "daysCount": len(plan.itinerary) if plan.itinerary else 0,
                "clonedFrom": plan.cloned_from,  # ID de l'auteur original
                "clonedFromPlanId": plan.cloned_from_plan_id,  # ID du plan original
                "createdAt": plan.created_at.isoformat() if plan.created_at else "",
            }
            for plan in cloned_plans
        ]
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def plans_by_city(request):
    """Récupère tous les plans publics en cherchant dans title, description et location"""
    try:
        search_query = request.GET.get("city", "").strip()
        user_id = request.GET.get("user_id", None)
        
        if not search_query:
            return JsonResponse({"error": "Veuillez spécifier une recherche"}, status=400)
        
        # Cherche dans title, description ET location (case-insensitive)
        from mongoengine import Q
        
        # Cherche dans title, description ET location avec Q objects
        query = Q(is_public=True) & (
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(location__icontains=search_query)
        )
        
        # Exclut les plans de l'utilisateur courant
        if user_id:
            query = query & Q(author_id__ne=user_id)
        
        plans = Plan.objects(query)
        
        data = []
        for plan in plans:
            # Récupérer les champs optionnels de manière sûre
            place_bucket = getattr(plan, 'place_bucket', None)
            city = getattr(plan, 'city', None)
            from_date = getattr(plan, 'from_date', None)
            to_date = getattr(plan, 'to_date', None)
            
            data.append({
                "id": str(plan.id),
                "title": plan.title,
                "description": plan.description,
                "location": plan.location,
                "author": plan.author_name or "Voyageur",
                "authorId": plan.author_id,
                "likes": plan.get_likes_count(),
                "commentsCount": plan.get_comments_count(),
                "isLiked": any(like.user_id == user_id for like in plan.likes) if user_id else False,
                "isCloned": user_id in plan.cloned_by if user_id else False,
                "createdAt": plan.created_at.isoformat(),
                "place_bucket": place_bucket if place_bucket and place_bucket.strip() else None,
                "city": city if city and city.strip() else None,
                "from_date": from_date if from_date and from_date.strip() else None,
                "to_date": to_date if to_date and to_date.strip() else None,
            })
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def follow_user(request, user_id):
    """Permet à l'utilisateur courant de suivre un autre utilisateur"""
    try:
        body = json.loads(request.body)
        current_user_id = body.get("current_user_id")
        
        if not current_user_id:
            return JsonResponse({"error": "current_user_id requis"}, status=400)
        
        # Récupère les profils
        user_profile = UserProfile.objects.get(user_id=user_id)
        current_profile = UserProfile.objects.get(user_id=current_user_id)
        
        # Ajoute le follow
        if current_user_id not in user_profile.followers:
            user_profile.followers.append(current_user_id)
            user_profile.save()
        
        if user_id not in current_profile.following:
            current_profile.following.append(user_id)
            current_profile.save()
        
        return JsonResponse({
            "success": True,
            "message": "Vous suivez maintenant cet utilisateur",
            "followers": len(user_profile.followers),
            "following": len(current_profile.following)
        })
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def unfollow_user(request, user_id):
    """Permet à l'utilisateur courant de ne plus suivre un utilisateur"""
    try:
        body = json.loads(request.body)
        current_user_id = body.get("current_user_id")
        
        if not current_user_id:
            return JsonResponse({"error": "current_user_id requis"}, status=400)
        
        # Récupère les profils
        user_profile = UserProfile.objects.get(user_id=user_id)
        current_profile = UserProfile.objects.get(user_id=current_user_id)
        
        # Retire le follow
        if current_user_id in user_profile.followers:
            user_profile.followers.remove(current_user_id)
            user_profile.save()
        
        if user_id in current_profile.following:
            current_profile.following.remove(user_id)
            current_profile.save()
        
        return JsonResponse({
            "success": True,
            "message": "Vous ne suivez plus cet utilisateur",
            "followers": len(user_profile.followers),
            "following": len(current_profile.following)
        })
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def remove_follower(request, user_id):
    """Permet à l'utilisateur courant de retirer un follower"""
    print(f"DEBUG: remove_follower called with user_id={user_id}")
    try:
        body = json.loads(request.body)
        follower_id = body.get("follower_id")
        print(f"DEBUG: follower_id={follower_id}")
        
        if not follower_id:
            return JsonResponse({"error": "follower_id requis"}, status=400)
        
        # Récupère les profils
        user_profile = UserProfile.objects.get(user_id=user_id)
        follower_profile = UserProfile.objects.get(user_id=follower_id)
        
        # Retire le follower
        if follower_id in user_profile.followers:
            user_profile.followers.remove(follower_id)
            user_profile.save()
        
        if user_id in follower_profile.following:
            follower_profile.following.remove(user_id)
            follower_profile.save()
        
        return JsonResponse({
            "success": True,
            "message": "Follower retiré avec succès",
            "followers": len(user_profile.followers)
        })
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def check_follow_status(request, user_id):
    """Vérifie si l'utilisateur courant suit un utilisateur"""
    try:
        current_user_id = request.GET.get("current_user_id")
        
        if not current_user_id:
            return JsonResponse({"error": "current_user_id requis"}, status=400)
        
        user_profile = UserProfile.objects.get(user_id=user_id)
        is_following = current_user_id in user_profile.followers
        
        return JsonResponse({
            "isFollowing": is_following,
            "followers": len(user_profile.followers),
            "following": len(user_profile.following) if user_profile else 0
        })
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def share_plan(request, plan_id):
    """Rend un plan public (partage)"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        
        if not user_id:
            return JsonResponse({"error": "user_id requis"}, status=400)
        
        # Récupère le plan
        plan = Plan.objects.get(id=plan_id)
        
        # Vérifie que l'utilisateur est l'auteur du plan
        if plan.author_id != user_id:
            return JsonResponse({"error": "Vous ne pouvez partager que vos propres plans"}, status=403)
        
        # Rend le plan public
        plan.is_public = True
        plan.save()
        
        return JsonResponse({
            "success": True,
            "message": "Plan rendu public avec succès",
            "planId": str(plan.id)
        })
    except Plan.DoesNotExist:
        return JsonResponse({"error": "Plan non trouvé"}, status=404)
    except Exception as e:
        print(f"Erreur dans share_plan: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def unshare_plan(request, plan_id):
    """Annule le partage d'un plan (le rend privé)"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        
        if not user_id:
            return JsonResponse({"error": "user_id requis"}, status=400)
        
        # Récupère le plan
        plan = Plan.objects.get(id=plan_id)
        
        # Vérifie que l'utilisateur est l'auteur du plan
        if plan.author_id != user_id:
            return JsonResponse({"error": "Vous ne pouvez annuler le partage que de vos propres plans"}, status=403)
        
        # Rend le plan privé
        plan.is_public = False
        plan.save()
        
        # Supprime la publication associée
        Publication.objects(shared_plan_id=str(plan.id)).delete()
        
        return JsonResponse({
            "success": True,
            "message": "Partage annulé avec succès",
            "planId": str(plan.id)
        })
    except Plan.DoesNotExist:
        return JsonResponse({"error": "Plan non trouvé"}, status=404)
    except Exception as e:
        print(f"Erreur dans unshare_plan: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def publications_feed(request):
    """Récupère toutes les publications pour la page d'accueil ou les publications d'un utilisateur spécifique"""
    try:
        user_id = request.GET.get("user_id", None)
        author_id = request.GET.get("author_id", None)
        
        # Récupère les publications
        if author_id:
            # Si author_id est spécifié, récupère uniquement les publications de cet auteur
            publications = Publication.objects(author_id=author_id).order_by('-created_at')
        else:
            # Sinon, récupère les publications selon le statut de connexion
            if user_id:
                # Utilisateur connecté: affiche UNIQUEMENT les publications des AUTRES utilisateurs
                publications = Publication.objects(author_id__ne=user_id).order_by('-created_at')
            else:
                # Utilisateur NON connecté: affiche TOUTES les publications
                publications = Publication.objects().order_by('-created_at')
        
        data = []
        for pub in publications:
            try:
                # Récupère le nombre de likes
                likes_count = len(pub.likes) if pub.likes else 0
                
                # Récupère les noms des utilisateurs qui ont liké
                liked_by = []
                if pub.likes:
                    for like in pub.likes:
                        if like.user_name:
                            liked_by.append(like.user_name)
                
                # Récupère le nombre de commentaires
                comments_count = len(pub.comments) if pub.comments else 0
                
                # Vérifie si l'utilisateur courant a liké
                is_liked = False
                if user_id and pub.likes:
                    is_liked = any(like.user_id == user_id for like in pub.likes)
                
                # Construit les données de la publication
                pub_data = {
                    "id": str(pub.id),
                    "authorId": pub.author_id,
                    "author": pub.author_name,
                    "description": pub.description,
                    "createdAt": pub.created_at.isoformat() if pub.created_at else "",
                    "likes": likes_count,
                    "likedBy": liked_by,
                    "commentsCount": comments_count,
                    "isLiked": is_liked,
                    "clonedBy": len(pub.cloned_by) if pub.cloned_by else 0,
                    "planSnapshot": None
                }
                
                # Ajoute le snapshot du plan s'il existe
                if pub.plan_snapshot:
                    # Convertir place_bucket
                    places = []
                    if pub.plan_snapshot.place_bucket:
                        for place in pub.plan_snapshot.place_bucket:
                            place_data = {
                                "name": getattr(place, 'name', getattr(place, 'title', 'Lieu')),
                                "title": getattr(place, 'title', ''),
                                "description": getattr(place, 'description', ''),
                            }
                            places.append(place_data)
                    
                    # Convertir itinerary
                    itinerary = []
                    if pub.plan_snapshot.itinerary:
                        for day in pub.plan_snapshot.itinerary:
                            # Récupérer les lieux pour ce jour
                            day_places = []
                            if hasattr(day, 'places') and day.places:
                                for place_id in day.places:
                                    # Chercher le lieu dans place_bucket
                                    for place in pub.plan_snapshot.place_bucket:
                                        if str(place.id) == str(place_id):
                                            day_places.append({
                                                "id": place.id,
                                                "name": place.name,
                                            })
                                            break
                            
                            day_data = {
                                "dayIndex": getattr(day, 'day_index', 0),
                                "date": day.date.isoformat() if hasattr(day, 'date') and day.date else "",
                                "description": getattr(day, 'description', ''),
                                "places": day_places,
                                "activities": getattr(day, 'activities', []),
                            }
                            itinerary.append(day_data)
                    
                    pub_data["planSnapshot"] = {
                        "city": pub.plan_snapshot.city,
                        "fromDate": pub.plan_snapshot.from_date.isoformat() if pub.plan_snapshot.from_date else "",
                        "toDate": pub.plan_snapshot.to_date.isoformat() if pub.plan_snapshot.to_date else "",
                        "placesCount": len(places),
                        "daysCount": len(itinerary),
                        "placeBucket": places,
                        "itinerary": itinerary,
                    }
                
                data.append(pub_data)
            except Exception as e:
                print(f"Erreur lors du traitement de la publication: {str(e)}")
                continue
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        print(f"Erreur dans publications_feed: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def publications_by_city(request):
    """Recherche les publications par ville"""
    try:
        search_query = request.GET.get("city", "").strip()
        user_id = request.GET.get("user_id", None)
        
        if not search_query:
            return JsonResponse({"error": "Veuillez spécifier une ville"}, status=400)
        
        # Cherche dans la ville du plan_snapshot (case-insensitive)
        from mongoengine import Q
        
        # Cherche dans plan_snapshot.city avec recherche partielle
        query = Q(plan_snapshot__city__icontains=search_query)
        
        # Exclut les publications de l'utilisateur courant
        if user_id:
            query = query & Q(author_id__ne=user_id)
        
        publications = Publication.objects(query).order_by('-created_at')
        
        data = []
        for pub in publications:
            try:
                # Récupère le nombre de likes
                likes_count = len(pub.likes) if pub.likes else 0
                
                # Récupère les noms des utilisateurs qui ont liké
                liked_by = []
                if pub.likes:
                    for like in pub.likes:
                        if like.user_name:
                            liked_by.append(like.user_name)
                
                # Récupère le nombre de commentaires
                comments_count = len(pub.comments) if pub.comments else 0
                
                # Vérifie si l'utilisateur courant a liké
                is_liked = False
                if user_id and pub.likes:
                    is_liked = any(like.user_id == user_id for like in pub.likes)
                
                # Construit les données de la publication
                pub_data = {
                    "id": str(pub.id),
                    "authorId": pub.author_id,
                    "author": pub.author_name,
                    "description": pub.description,
                    "createdAt": pub.created_at.isoformat() if pub.created_at else "",
                    "likes": likes_count,
                    "likedBy": liked_by,
                    "commentsCount": comments_count,
                    "isLiked": is_liked,
                    "clonedBy": len(pub.cloned_by) if pub.cloned_by else 0,
                    "planSnapshot": None
                }
                
                # Ajoute le snapshot du plan s'il existe
                if pub.plan_snapshot:
                    # Convertir place_bucket
                    places = []
                    if pub.plan_snapshot.place_bucket:
                        for place in pub.plan_snapshot.place_bucket:
                            place_data = {
                                "name": getattr(place, 'name', getattr(place, 'title', 'Lieu')),
                                "title": getattr(place, 'title', ''),
                                "description": getattr(place, 'description', ''),
                            }
                            places.append(place_data)
                    
                    # Convertir itinerary
                    itinerary = []
                    if pub.plan_snapshot.itinerary:
                        for day in pub.plan_snapshot.itinerary:
                            # Récupérer les lieux pour ce jour
                            day_places = []
                            if hasattr(day, 'places') and day.places:
                                for place_id in day.places:
                                    # Chercher le lieu dans place_bucket
                                    for place in pub.plan_snapshot.place_bucket:
                                        if str(place.id) == str(place_id):
                                            day_places.append({
                                                "id": place.id,
                                                "name": place.name,
                                            })
                                            break
                            
                            day_data = {
                                "dayIndex": getattr(day, 'day_index', 0),
                                "date": day.date.isoformat() if hasattr(day, 'date') and day.date else "",
                                "description": getattr(day, 'description', ''),
                                "places": day_places,
                                "activities": getattr(day, 'activities', []),
                            }
                            itinerary.append(day_data)
                    
                    pub_data["planSnapshot"] = {
                        "city": pub.plan_snapshot.city,
                        "fromDate": pub.plan_snapshot.from_date.isoformat() if pub.plan_snapshot.from_date else "",
                        "toDate": pub.plan_snapshot.to_date.isoformat() if pub.plan_snapshot.to_date else "",
                        "placesCount": len(places),
                        "daysCount": len(itinerary),
                        "placeBucket": places,
                        "itinerary": itinerary,
                    }
                
                data.append(pub_data)
            except Exception as e:
                print(f"Erreur lors du traitement de la publication: {str(e)}")
                continue
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        print(f"Erreur dans publications_by_city: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def like_publication(request, pub_id):
    """Like une publication"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        
        if not user_id:
            return JsonResponse({"error": "user_id requis"}, status=400)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Vérifie si l'utilisateur a déjà liké
        already_liked = any(like.user_id == user_id for like in publication.likes)
        
        if already_liked:
            # Retire le like
            publication.likes = [like for like in publication.likes if like.user_id != user_id]
        else:
            # Ajoute un like
            like = Like(user_id=user_id, user_name=user_name)
            publication.likes.append(like)
        
        publication.save()
        
        return JsonResponse({
            "success": True,
            "liked": not already_liked,
            "likesCount": len(publication.likes)
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Exception as e:
        print(f"Erreur dans like_publication: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_publication_comment(request, pub_id):
    """Ajoute un commentaire à une publication"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        text = body.get("text")
        
        if not user_id or not text:
            return JsonResponse({"error": "user_id et text requis"}, status=400)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Crée un nouveau commentaire
        comment = Comment(
            id=str(uuid.uuid4()),
            author_id=user_id,
            author_name=user_name,
            text=text,
            replies=[],
            reactions=[]
        )
        
        publication.comments.append(comment)
        publication.save()
         # Crée une notification
        if publication.author_id != user_id:
            notification = Notification(
                recipient_id=publication.author_id,
                sender_id=user_id,
                sender_name=user_name,
                action_type="comment",
                message=f"{user_name} a commenté votre publication: {publication.description}"
            )
            notification.save()
        
        return JsonResponse({
            "success": True,
            "comment": {
                "id": comment.id,
                "authorId": comment.author_id,
                "author": comment.author_name,
                "text": comment.text,
                "createdAt": comment.created_at.isoformat(),
                "replies": [],
                "reactions": []
            }
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Exception as e:
        print(f"Erreur dans add_publication_comment: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_publication_reply(request, pub_id, comment_id):
    """Ajoute une réponse à un commentaire d'une publication"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        text = body.get("text")
        
        if not user_id or not text:
            return JsonResponse({"error": "user_id et text requis"}, status=400)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Trouve le commentaire
        comment = None
        for c in publication.comments:
            if c.id == comment_id:
                comment = c
                break
        
        if not comment:
            return JsonResponse({"error": "Commentaire non trouvé"}, status=404)
        
        # Crée une réponse
        reply = Reply(
            id=str(uuid.uuid4()),
            author_id=user_id,
            author_name=user_name,
            text=text
        )
        
        comment.replies.append(reply)
        publication.save()
        
        return JsonResponse({
            "success": True,
            "reply": {
                "id": reply.id,
                "authorId": reply.author_id,
                "author": reply.author_name,
                "text": reply.text,
                "createdAt": reply.created_at.isoformat()
            }
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Exception as e:
        print(f"Erreur dans add_publication_reply: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def add_publication_reaction(request, pub_id, comment_id):
    """Ajoute une réaction à un commentaire d'une publication"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        emoji = body.get("emoji")
        
        if not user_id or not emoji:
            return JsonResponse({"error": "user_id et emoji requis"}, status=400)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Trouve le commentaire
        comment = None
        for c in publication.comments:
            if c.id == comment_id:
                comment = c
                break
        
        if not comment:
            return JsonResponse({"error": "Commentaire non trouvé"}, status=404)
        
        # Vérifie si l'utilisateur a déjà réagi
        existing_reaction = None
        for r in comment.reactions:
            if r.author_id == user_id and r.type == emoji:
                existing_reaction = r
                break
        
        if existing_reaction:
            # Retire la réaction
            comment.reactions = [r for r in comment.reactions if not (r.author_id == user_id and r.type == emoji)]
        else:
            # Ajoute une réaction
            reaction = Reaction(
                id=str(uuid.uuid4()),
                author_id=user_id,
                author_name=user_name,
                type=emoji
            )
            comment.reactions.append(reaction)
        
        publication.save()
        
        return JsonResponse({
            "success": True,
            "reactions": [
                {
                    "id": r.id,
                    "authorId": r.author_id,
                    "author": r.author_name,
                    "type": r.type
                }
                for r in comment.reactions
            ]
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Exception as e:
        print(f"Erreur dans add_publication_reaction: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def clone_publication(request, pub_id):
    """Clone un plan à partir d'une publication"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        user_name = body.get("user_name")
        
        if not user_id:
            return JsonResponse({"error": "user_id requis"}, status=400)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Récupère le plan original
        original_plan = Plan.objects.get(id=publication.shared_plan_id)
        
        # Crée une copie du plan
        cloned_plan = Plan(
            author_id=user_id,
            author_name=user_name,
            city=original_plan.city,
            from_date=original_plan.from_date,
            to_date=original_plan.to_date,
            is_public=False,
            place_bucket=original_plan.place_bucket if original_plan.place_bucket else [],
            itinerary=original_plan.itinerary if original_plan.itinerary else [],
            cloned_from=original_plan.author_id,
            cloned_from_plan_id=str(original_plan.id)
        )
        cloned_plan.save()
        
        # Ajoute l'utilisateur à la liste des cloneurs de la publication
        if user_id not in publication.cloned_by:
            publication.cloned_by.append(user_id)
            publication.save()
        
        return JsonResponse({
            "success": True,
            "message": "Plan cloné avec succès",
            "planId": str(cloned_plan.id),
            "clonedCount": len(publication.cloned_by)
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Plan.DoesNotExist:
        return JsonResponse({"error": "Plan non trouvé"}, status=404)
    except Exception as e:
        print(f"Erreur dans clone_publication: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def get_publication_details(request, pub_id):
    """Récupère les détails complets d'une publication avec commentaires"""
    try:
        user_id = request.GET.get("user_id", None)
        
        publication = Publication.objects.get(id=pub_id)
        
        # Vérifie si l'utilisateur a liké
        is_liked = False
        if user_id and publication.likes:
            is_liked = any(like.user_id == user_id for like in publication.likes)
        
        # Construit les commentaires avec réponses et réactions
        comments_data = []
        for comment in publication.comments:
            replies_data = [
                {
                    "id": reply.id,
                    "authorId": reply.author_id,
                    "author": reply.author_name,
                    "text": reply.text,
                    "createdAt": reply.created_at.isoformat()
                }
                for reply in comment.replies
            ]
            
            reactions_data = [
                {
                    "id": r.id,
                    "authorId": r.author_id,
                    "author": r.author_name,
                    "type": r.type
                }
                for r in comment.reactions
            ]
            
            comments_data.append({
                "id": comment.id,
                "authorId": comment.author_id,
                "author": comment.author_name,
                "text": comment.text,
                "createdAt": comment.created_at.isoformat(),
                "replies": replies_data,
                "reactions": reactions_data
            })
        
        # Construit la liste des cloneurs
        cloned_by_data = []
        for cloner_id in publication.cloned_by:
            try:
                cloner_profile = UserProfile.objects.get(user_id=cloner_id)
                cloned_by_data.append({
                    "userId": cloner_id,
                    "username": cloner_profile.username
                })
            except:
                cloned_by_data.append({"userId": cloner_id, "username": "Utilisateur"})
        
        # Construit la liste des likes
        likes_data = []
        for like in publication.likes:
            try:
                liker_profile = UserProfile.objects.get(user_id=like.user_id)
                likes_data.append({
                    "userId": like.user_id,
                    "username": liker_profile.username
                })
            except:
                likes_data.append({"userId": like.user_id, "username": "Utilisateur"})
        
        return JsonResponse({
            "id": str(publication.id),
            "authorId": publication.author_id,
            "author": publication.author_name,
            "description": publication.description,
            "createdAt": publication.created_at.isoformat(),
            "likes": likes_data,
            "likesCount": len(publication.likes),
            "isLiked": is_liked,
            "comments": comments_data,
            "commentsCount": len(publication.comments),
            "clonedBy": cloned_by_data,
            "clonedCount": len(publication.cloned_by)
        })
    except Publication.DoesNotExist:
        return JsonResponse({"error": "Publication non trouvée"}, status=404)
    except Exception as e:
        print(f"Erreur dans get_publication_details: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET"])
def all_users(request):
    """Récupère tous les utilisateurs sauf l'utilisateur courant"""
    try:
        current_user_id = request.GET.get("current_user_id")
        
        # Récupère le profil de l'utilisateur courant pour obtenir ses followers
        current_user_followers = []
        if current_user_id:
            try:
                current_profile = UserProfile.objects.get(user_id=current_user_id)
                current_user_followers = current_profile.followers  # Les followers de l'utilisateur courant
            except UserProfile.DoesNotExist:
                pass
        
        # Récupère tous les utilisateurs
        all_profiles = UserProfile.objects()
        
        # Filtre pour exclure l'utilisateur courant
        if current_user_id:
            all_profiles = all_profiles(user_id__ne=current_user_id)
        
        data = []
        for profile in all_profiles:
            # Calculer les amis en commun (intersection entre les followers de l'utilisateur courant et les followers du profil)
            common_followers = len(set(current_user_followers) & set(profile.followers))
            
            data.append({
                "userId": profile.user_id,
                "username": profile.username,
                "email": profile.email,
                "bio": profile.bio,
                "avatarUrl": profile.avatar_url,
                "followers": len(profile.followers),
                "following": len(profile.following),
                "commonFollowers": common_followers,
                "isFollowing": current_user_id in profile.followers if current_user_id else False,
                "publicPlansCount": len(Plan.objects(author_id=profile.user_id, is_public=True))
            })
        
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def publish_plan(request, plan_id):
    """Crée une publication à partir d'un plan privé"""
    try:
        body = json.loads(request.body)
        user_id = body.get("user_id")
        description = body.get("description", "")
        
        if not user_id:
            return JsonResponse({"error": "user_id est requis"}, status=400)
        
        # Récupère le plan
        plan = Plan.objects.get(id=plan_id)
        
        # Vérifier que c'est le propriétaire du plan
        if plan.author_id != user_id:
            return JsonResponse({"error": "Vous ne pouvez pas publier ce plan"}, status=403)
        
        # Récupère le profil utilisateur pour le nom
        profile = UserProfile.objects.get(user_id=user_id)
        
        # Créer la publication
        publication = Publication(
            shared_plan_id=str(plan.id),
            author_id=user_id,
            author_name=profile.username,
            description=description,
            plan_snapshot=PlanSnapshot(
                city=plan.city,
                from_date=plan.from_date,
                to_date=plan.to_date,
                place_bucket=plan.place_bucket,
                itinerary=plan.itinerary
            )
        )
        publication.save()
        
        return JsonResponse({
            "success": True,
            "message": "Publication créée avec succès",
            "publication_id": str(publication.id)
        })
    except Plan.DoesNotExist:
        return JsonResponse({"error": "Plan non trouvé"}, status=404)
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil utilisateur non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def update_user_profile(request, user_id):
    """Met à jour le profil d'un utilisateur et tous ses contenus associés"""
    try:
        body = json.loads(request.body)
        username = body.get("username")
        bio = body.get("bio", "")
        email = body.get("email")
        current_password = body.get("current_password")
        new_password = body.get("new_password")
        
        if not username or not email:
            return JsonResponse({"error": "username et email sont requis"}, status=400)
        
        # Récupère le profil
        profile = UserProfile.objects.get(user_id=user_id)
        old_username = profile.username  # Sauvegarder l'ancien nom
        
        # Récupère aussi l'utilisateur dans la collection 'users'
        from social.models import User
        user = User.objects.get(userId=user_id)
        
        # Vérifier et mettre à jour le mot de passe si fourni
        if current_password and new_password:
            # Vérifier le mot de passe actuel
            if not user.check_password(current_password):
                return JsonResponse({"error": "Mot de passe actuel incorrect"}, status=400)
            
            # Mettre à jour le mot de passe
            user.set_password(new_password)
        
        # Met à jour les champs dans UserProfile
        profile.username = username
        profile.bio = bio
        profile.email = email
        profile.save()
        
        # ✅ Met à jour aussi dans la collection 'users'
        user.username = username
        user.bio = bio
        user.email = email
        user.updatedAt = datetime.utcnow()
        user.save()
        
        # ✅ IMPORTANT: Mettre à jour TOUTES les publications de cet utilisateur
        Publication.objects(author_id=user_id).update(set__author_name=username)
        
        # ✅ Mettre à jour TOUS les commentaires de cet utilisateur dans les publications
        # Récupérer toutes les publications avec des commentaires de cet utilisateur
        publications_with_comments = Publication.objects(comments__author_id=user_id)
        for pub in publications_with_comments:
            for comment in pub.comments:
                if comment.author_id == user_id:
                    comment.author_name = username
            pub.save()
        
        # ✅ Mettre à jour les réponses aux commentaires
        publications_with_replies = Publication.objects(comments__replies__author_id=user_id)
        for pub in publications_with_replies:
            for comment in pub.comments:
                for reply in comment.replies:
                    if reply.author_id == user_id:
                        reply.author_name = username
            pub.save()
        
        # ✅ Mettre à jour les réactions aux commentaires
        publications_with_reactions = Publication.objects(comments__reactions__author_id=user_id)
        for pub in publications_with_reactions:
            for comment in pub.comments:
                for reaction in comment.reactions:
                    if reaction.author_id == user_id:
                        reaction.author_name = username
            pub.save()
        
        # ✅ Mettre à jour la collection 'plans' - tous les plans de cet utilisateur
        Plan.objects(author_id=user_id).update(set__author_name=username)
        
        return JsonResponse({
            "success": True,
            "message": "Profil mis à jour avec succès",
            "profile": {
                "userId": profile.user_id,
                "username": profile.username,
                "email": profile.email,
                "bio": profile.bio
            }
        })
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "Profil non trouvé"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def sync_publications_with_plans(request, user_id):
    """Synchronise les publications avec les plans - corrige les plans qui devraient être publics"""
    try:
        # Récupère toutes les publications de cet utilisateur
        publications = Publication.objects(author_id=user_id)
        
        updated_count = 0
        
        for pub in publications:
            # Récupère le plan correspondant
            if pub.shared_plan_id:
                try:
                    plan = Plan.objects.get(id=pub.shared_plan_id)
                    
                    # Si le plan n'est pas public, le rendre public
                    if not plan.is_public:
                        plan.is_public = True
                        plan.save()
                        updated_count += 1
                        
                        # Ajouter aussi au profil si nécessaire
                        profile = UserProfile.objects.get(user_id=user_id)
                        if str(plan.id) not in profile.public_plans:
                            profile.public_plans.append(str(plan.id))
                            profile.save()
                except Plan.DoesNotExist:
                    pass
        
        return JsonResponse({
            "success": True,
            "message": f"Synchronisation complétée: {updated_count} plan(s) mis à jour",
            "updated_count": updated_count
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def create_notification(request):
    """Crée une notification"""
    try:
        body = json.loads(request.body)
        recipient_id = body.get("recipient_id")
        sender_id = body.get("sender_id")
        sender_name = body.get("sender_name")
        action_type = body.get("action_type")  # like, comment, clone
        pub_id = body.get("pub_id")
        description = body.get("description", "")
        
        if not recipient_id or not sender_id or not action_type:
            return JsonResponse({"error": "Paramètres requis manquants"}, status=400)
        
        # Générer le message automatiquement selon l'action avec description de la publication
        action_prefix = {
            "like": f"{sender_name} a aimé votre publication",
            "comment": f"{sender_name} a commenté votre publication",
            "clone": f"{sender_name} a cloné votre plan"
        }
        
        base_message = action_prefix.get(action_type, f"{sender_name} a interagi avec votre publication")
        
        # Ajouter le détail de la publication si disponible
        if description:
            # Limiter la description à 50 caractères pour éviter un message trop long
            desc_preview = description[:50] + "..." if len(description) > 50 else description
            message = f"{base_message}: \"{desc_preview}\""
        else:
            message = base_message
        
        # Créer la notification
        notification = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            sender_name=sender_name,
            action_type=action_type,
            pub_id=pub_id,
            description=description,
            message=message,
            created_at=datetime.utcnow()
        )
        notification.save()
        
        return JsonResponse({
            "success": True,
            "message": "Notification créée avec succès",
            "notification_id": str(notification.id)
        })
    except Exception as e:
        print(f"Erreur dans create_notification: {str(e)}")
        return JsonResponse({"error": str(e)}, status=400)
